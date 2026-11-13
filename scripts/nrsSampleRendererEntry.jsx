/** Bundled solely by scripts/generate-nrs-samples.mjs; never imported by Vite. */
import { DOCUMENT_TYPES } from '../src/components/documents/documentModels.js'
import { renderDocumentPdf } from '../src/components/documents/pdf.jsx'

export async function renderFictionalSample(documentType, sourceRecord, organization, state, number) {
  if (state !== 'current' && state !== 'mock-post-validation') throw new Error(`Unsupported sample state: ${state}`)
  const record = structuredClone(sourceRecord)
  // These values are presentation-only. The real NRS evidence guard must remain untouched.
  record.nrs_evidence = state === 'mock-post-validation'
    ? {
      sample_mode: 'mock-post-validation',
      fixture_only: true,
      irn: `MOCK-DEMO-IRN-${String(number).padStart(4, '0')}`,
      csid: `MOCK-DEMO-CSID-${String(number).padStart(4, '0')}`,
      qr_payload: `DIGITALINVOICE DEMO ONLY - MOCK QR - NOT OFFICIAL VERIFICATION - SAMPLE ${number}`,
      source_document_type: documentType,
    }
    : null

  const build = DOCUMENT_TYPES[documentType]?.build
  if (!build) throw new Error(`Unsupported document type: ${documentType}`)
  const model = build(record, organization, '')
  model.statuses = [
    { text: 'FICTIONAL SAMPLE', tone: 'neutral' },
    ...model.statuses,
  ]
  model.footer.note = state === 'current'
    ? 'FICTIONAL DIGITALINVOICE SAMPLE — DOCUMENT LAYOUT DEMONSTRATION ONLY.'
    : 'ILLUSTRATIVE DESIGN SAMPLE — MOCK IRN, CSID AND QR. NO OFFICIAL VERIFICATION.'
  return renderDocumentPdf(model)
}
