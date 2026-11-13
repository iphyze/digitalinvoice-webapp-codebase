#!/usr/bin/env node
/**
 * D5: Generate eight fictional PDF / PNG examples using DigitalInvoice's own
 * documentModels.js and pdf.jsx. Development-only; no API, DB or NRS requests.
 *
 * npm run samples:nrs
 * npm run samples:nrs -- --out "C:/path/to/teecoms/public/docs/samples"
 *
 * Prerequisite: Poppler's `pdftoppm` executable on PATH (or PDFTOPPM_BIN set).
 * `esbuild` is a pinned dev dependency and is only used to bundle the original
 * JSX for Node. The PDF evidence component is replaced in the temporary bundle
 * with an explicit mock-only renderer. Production source remains unchanged.
 */
import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { assertSampleArithmetic, fictionalDocuments, fictionalSeller } from './nrsSampleFixtures.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const defaultOut = path.join(projectRoot, 'generated-nrs-samples')
const usage = `Usage: npm run samples:nrs [-- --out PATH]\n\n` +
  `Produces 8 fictional PDFs plus 8 matching PNG previews.\n` +
  `Requires Poppler pdftoppm on PATH (or PDFTOPPM_BIN).\n` +
  `Output defaults to generated-nrs-samples/ under the DigitalInvoice frontend.\n`

function readArgs(argv) {
  let outDir = defaultOut
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--help' || argv[i] === '-h') { process.stdout.write(usage); process.exit(0) }
    if (argv[i] === '--out' && argv[i + 1]) { outDir = path.resolve(argv[++i]); continue }
    throw new Error(`Unknown or incomplete argument: ${argv[i]}\n${usage}`)
  }
  // Never permit generated content to overwrite the app source tree or site root.
  if ([projectRoot, scriptDir, path.join(projectRoot, 'src'), path.join(projectRoot, 'public')]
    .some((protectedDir) => path.resolve(outDir) === protectedDir) ||
    [scriptDir, path.join(projectRoot, 'src')].some((root) => path.resolve(outDir).startsWith(root + path.sep))) {
    throw new Error('The output directory must be a dedicated samples directory, not a project/source root.')
  }
  return outDir
}

function validatePoppler() {
  const binary = process.env.PDFTOPPM_BIN || 'pdftoppm'
  const result = spawnSync(binary, ['-v'], { encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    throw new Error(`Poppler pdftoppm was not found (${binary}). Install Poppler and add its bin directory to PATH, or set PDFTOPPM_BIN to the executable path. No samples were published.`)
  }
  return binary
}

async function bundleDevelopmentRenderer(bundleFile) {
  const originalPdfPath = path.join(projectRoot, 'src/components/documents/pdf.jsx')
  const mockEvidencePath = path.join(scriptDir, 'nrsSampleEvidence.jsx')
  let mockReplacements = 0
  await build({
    entryPoints: [path.join(scriptDir, 'nrsSampleRendererEntry.jsx')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    jsx: 'automatic',
    outfile: bundleFile,
    logLevel: 'warning',
    plugins: [
      {
        name: 'development-only-nrs-mock-evidence',
        setup(builder) {
          builder.onResolve({ filter: /^\.\.\/nrs\/NrsPdfEvidence$/ }, (args) => {
            if (path.resolve(args.importer) !== originalPdfPath) return undefined
            mockReplacements += 1
            return { path: mockEvidencePath }
          })
        },
      },
      {
        name: 'local-absolute-font-paths',
        setup(builder) {
          // Vite normally turns font imports into URLs; Node's react-pdf needs paths.
          builder.onResolve({ filter: /\.ttf$/ }, (args) => ({
            path: path.resolve(args.resolveDir, args.path), namespace: 'sample-font-path',
          }))
          builder.onLoad({ filter: /.*/, namespace: 'sample-font-path' }, (args) => ({
            contents: `export default ${JSON.stringify(args.path)};`, loader: 'js',
          }))
        },
      },
    ],
  })
  if (mockReplacements !== 1) {
    throw new Error(`Safety check failed: expected exactly one NRS evidence substitution, got ${mockReplacements}. Renderer was not executed.`)
  }
}

async function validatePdfAndPng(pdfPath, pngPath) {
  const pdfBuffer = await readFile(pdfPath)
  const pngBuffer = await readFile(pngPath)
  if (pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error(`Invalid PDF output: ${pdfPath}`)
  if (!pngBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`Invalid PNG output: ${pngPath}`)
  if (pdfBuffer.length < 1500 || pngBuffer.length < 1500) throw new Error('Generated sample file is unusually small; refusing to publish it.')
}

async function generate() {
  const destination = readArgs(process.argv.slice(2))
  assertSampleArithmetic()
  const converter = validatePoppler()
  const temporary = await mkdtemp(path.join(scriptDir, '.nrs-samples-tmp-'))
  const bundleFile = path.join(temporary, 'sample-renderer.mjs')
  try {
    await bundleDevelopmentRenderer(bundleFile)
    const { renderFictionalSample } = await import(pathToFileURL(bundleFile).href)
    const manifest = []
    for (const [index, example] of fictionalDocuments.entries()) {
      for (const state of ['current', 'mock-post-validation']) {
        const basename = `digitalinvoice-${example.key}-${state}-v1.0`
        const pdfName = `${basename}.pdf`
        const pngName = `${basename}.png`
        const pdfPath = path.join(temporary, pdfName)
        const pngPath = path.join(temporary, pngName)

        const blob = await renderFictionalSample(example.documentType, example.record, fictionalSeller, state, index + 1)
        await writeFile(pdfPath, Buffer.from(await blob.arrayBuffer()))
        const converted = spawnSync(converter, [
          '-f', '1', '-l', '1', '-singlefile', '-r', '145', '-png',
          pdfPath, path.join(temporary, basename),
        ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 8 })
        if (converted.error || converted.status !== 0) {
          throw new Error(`PNG conversion failed for ${pdfName}: ${converted.error?.message || converted.stderr || 'Unknown error'}`)
        }
        await validatePdfAndPng(pdfPath, pngPath)
        manifest.push({
          title: example.title,
          state,
          pdf: pdfName,
          preview: pngName,
          fictional: true,
          nrsIssued: false,
          nrsValidated: false,
        })
        process.stdout.write(`  ✓ ${pdfName} + PNG\n`)
      }
    }

    await mkdir(destination, { recursive: true })
    for (const item of manifest) {
      await copyFile(path.join(temporary, item.pdf), path.join(destination, item.pdf))
      await copyFile(path.join(temporary, item.preview), path.join(destination, item.preview))
    }
    await writeFile(path.join(destination, 'samples-manifest.json'), JSON.stringify({
      source: 'DigitalInvoice frontend documentModels.js + pdf.jsx',
      disclaimer: 'Fictional samples for document design review. Mock identifiers and QR values are illustrations, not official verification evidence.',
      items: manifest,
    }, null, 2) + '\n')
    await writeFile(path.join(destination, 'README.txt'),
      'DigitalInvoice D5: FICTIONAL SAMPLE DOCUMENTS FOR DESIGN REVIEW.\n' +
      'Copy the eight .pdf files and eight .png files into the Teecoms website\n' +
      'public/docs/samples/ folder. Never submit mock QR data as NRS evidence.\n' +
      'Generated using the real DigitalInvoice document model and PDF template,\n' +
      'with a separate development-only renderer for visibly labelled mock NRS fields.\n')
    process.stdout.write(`\nCreated ${manifest.length} PDFs and ${manifest.length} PNG previews at:\n  ${destination}\n`)
    process.stdout.write('Copy the PDFs and PNGs to the Teecoms public/docs/samples/ folder before publishing the gallery.\n')
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

generate().catch((error) => {
  process.stderr.write(`NRS sample generation failed: ${error.stack || error}\n`)
  process.exitCode = 1
})
