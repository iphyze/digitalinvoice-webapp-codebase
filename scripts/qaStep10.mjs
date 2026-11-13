#!/usr/bin/env node
/**
 * DigitalInvoice Step 10 release gate. No third-party imports, no credentials,
 * no writes. Source, production bundle, Apache and public API checks are
 * separately selectable. Never takes an authenticated session.
 *
 * Examples:
 * node scripts/qaStep10.mjs --mode=source --csp-file=/path/to/your/updated/.htaccess
 * node scripts/qaStep10.mjs --mode=built --csp-file=/path/to/your/updated/.htaccess
 * node scripts/qaStep10.mjs --mode=apache --url=https://digitalinvoice.ng --api-url=https://api.digitalinvoice.ng
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODES = new Set(['source', 'built', 'apache']);

export function parseArguments(argv) {
  const options = {};
  for (const argument of argv) {
    if (!argument.startsWith('--') || !argument.includes('=')) {
      throw new Error(`Unknown argument: ${argument}. Use --key=value.`);
    }
    const [name, ...parts] = argument.slice(2).split('=');
    if (!['mode', 'csp-file', 'dist', 'url', 'api-url'].includes(name) || !parts.join('=')) {
      throw new Error(`Unknown or empty option: --${name}.`);
    }
    if (Object.hasOwn(options, name)) throw new Error(`Duplicate option: --${name}.`);
    options[name] = parts.join('=');
  }
  options.mode ||= 'source';
  if (!MODES.has(options.mode)) throw new Error('Mode must be source, built or apache.');
  if (options.mode === 'apache' && !options.url) throw new Error('Apache mode requires --url=https://your-frontend-host.');
  for (const key of ['url', 'api-url']) {
    if (!options[key]) continue;
    let location;
    try { location = new URL(options[key]); } catch { throw new Error(`--${key} must be an absolute URL.`); }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (location.protocol !== 'https:' && !(location.protocol === 'http:' && loopback)) {
      throw new Error(`--${key} must use HTTPS (HTTP is allowed only for loopback).`);
    }
    if (location.username || location.password) throw new Error(`--${key} must not include credentials.`);
  }
  return options;
}

export function parseCsp(heading) {
  const match = String(heading).match(/^\s*Header\s+always\s+set\s+Content-Security-Policy\s+"([^"]+)"/im);
  const policy = match?.[1] || '';
  const directives = new Map();
  for (const part of policy.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length) directives.set(tokens[0].toLowerCase(), tokens.slice(1));
  }
  return { policy, directives };
}

export function cspFailures(input, apiUrl = null) {
  const { policy, directives } = parseCsp(input);
  if (!policy) return ['Content-Security-Policy header is missing from Apache .htaccess'];
  const errors = [];
  const contains = (name, token) => directives.get(name)?.includes(token);
  if (!contains('script-src', "'wasm-unsafe-eval'")) errors.push("script-src must include 'wasm-unsafe-eval' for react-pdf");
  if (!contains('connect-src', 'data:')) errors.push('connect-src must include data: for react-pdf module loading');
  if (JSON.stringify(directives.get('frame-ancestors')) !== JSON.stringify(["'none'"])) errors.push("frame-ancestors must be 'none' only");
  if (JSON.stringify(directives.get('object-src')) !== JSON.stringify(["'none'"])) errors.push("object-src must be 'none' only");
  if (contains('script-src', "'unsafe-eval'")) errors.push("script-src must not permit unrestricted 'unsafe-eval'");
  for (const name of ['script-src', 'connect-src']) {
    if (contains(name, '*')) errors.push(`${name} must not include a wildcard`);
  }
  if (apiUrl) {
    let origin;
    try { origin = new URL(apiUrl).origin; } catch { errors.push('Configured API URL is not valid'); }
    if (origin && !contains('connect-src', origin) && origin !== "'self'") {
      errors.push(`connect-src does not allow the configured API origin ${origin}`);
    }
  }
  return errors;
}

const read = (path) => readFileSync(path, 'utf8');
export async function run(options, output = console.log) {
  const failures = [];
  const warnings = [];
  let checks = 0;
  const pass = (label) => { checks++; output(`PASS  ${label}`); };
  const fail = (label) => { checks++; failures.push(label); output(`FAIL  ${label}`); };
  const warn = (label) => { warnings.push(label); output(`SKIP  ${label}`); };
  const verify = (condition, label) => (condition ? pass(label) : fail(label));

  const htaccessPath = resolve(options['csp-file'] || join(ROOT, 'public/.htaccess'));
  const frontendIndex = join(ROOT, 'index.html');
  verify(existsSync(htaccessPath), `Apache CSP file exists: ${htaccessPath}`);
  if (existsSync(htaccessPath)) {
    const apache = read(htaccessPath);
    const violations = cspFailures(apache, options['api-url'] || null);
    if (violations.length) violations.forEach(fail);
    else pass('Apache CSP includes PDF WASM/data allowances and anti-framing directives');
    verify(/RewriteRule\s+\.\s+\/index\.html\s+\[L\]/.test(apache), 'Apache SPA fallback serves index.html');
    verify(/Files\s+["']?theme-init\.js/.test(apache) && /no-cache/.test(apache), 'Theme bootstrap uses non-immutable caching');
  }
  verify(existsSync(frontendIndex), 'Frontend index.html exists');
  if (existsSync(frontendIndex)) verify(/src="\/theme-init\.js"/.test(read(frontendIndex)), 'Theme bootstrap runs before React');
  verify(existsSync(join(ROOT, 'src/components/nrs/nrsEvidence.js')), 'Shared production NRS evidence gate exists');
  verify(existsSync(join(ROOT, 'src/services/erpIntegrationService.js')), 'ERP management service exists');
  verify(existsSync(join(ROOT, 'src/app/guards/index.jsx')), 'Protected route guards exist');

  const dist = resolve(options.dist || join(ROOT, 'dist'));
  if (options.mode !== 'source') {
    const builtIndex = join(dist, 'index.html');
    verify(existsSync(builtIndex), `Built index exists (${dist})`);
    if (existsSync(builtIndex)) {
      const html = read(builtIndex);
      const assets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"?#]+\.(?:js|css))(?:\?[^"#]*)?"/g)].map((m) => m[1]);
      verify(assets.some((asset) => asset.endsWith('.js')), 'Bundle index references hashed JavaScript assets');
      verify(assets.length > 0 && assets.every((asset) => existsSync(join(dist, asset))), 'Every index asset resolves inside dist');
      verify(existsSync(join(dist, 'theme-init.js')), 'Built theme bootstrap is deployed');
      verify(existsSync(join(dist, '.htaccess')), 'Built dist contains Apache .htaccess');
      if (existsSync(join(dist, '.htaccess'))) {
        const violations = cspFailures(read(join(dist, '.htaccess')), options['api-url'] || null);
        if (violations.length) violations.forEach((v) => fail(`Built CSP: ${v}`));
        else pass('Built CSP includes PDF allowances');
      }
    }
  }
  if (options.mode === 'apache') {
    const site = new URL(options.url);
    verify(site.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname), 'Frontend URL is HTTPS (or loopback)');
    const request = async (path, origin = null) => {
      const response = await fetch(new URL(path, site), {
        method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: origin ? { Origin: origin } : {},
      });
      return { response, body: await response.text() };
    };
    try {
      for (const path of ['/', '/app/invoices/step10-nonexistent-route']) {
        const { response, body } = await request(path);
        verify(response.status === 200 && /text\/html/i.test(response.headers.get('content-type') || ''), `${path} serves SPA HTML via Apache`);
        verify(/<div\s+id="root"/.test(body), `${path} returns React mount point`);
        const csp = response.headers.get('content-security-policy') || '';
        const checksCsp = cspFailures(`Header always set Content-Security-Policy "${csp}"`, options['api-url'] || null);
        if (checksCsp.length) checksCsp.forEach((v) => fail(`Live ${path}: ${v}`));
        else pass(`${path} live CSP supports PDFs and anti-framing`);
        verify(!/immutable/i.test(response.headers.get('cache-control') || ''), `${path} HTML is not immutable`);
      }
      const theme = await request('/theme-init.js');
      verify(theme.response.status === 200 && theme.body.includes('digitalinvoice-theme'), 'Apache serves theme bootstrap');
      verify(!/immutable/i.test(theme.response.headers.get('cache-control') || ''), 'Apache theme bootstrap is not cached immutably');
    } catch (error) { fail(`Cannot complete live Apache checks (${error.name || 'network error'})`); }
    if (options['api-url']) {
      const url = new URL('auth/config', options['api-url'].replace(/\/$/, '') + '/');
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Origin: site.origin } });
        verify(response.ok, 'Public auth/config is reachable over HTTPS');
        verify(response.headers.get('access-control-allow-origin') === site.origin, 'API CORS allows this exact frontend origin');
        verify(response.headers.get('access-control-allow-credentials') === 'true', 'API CORS allows credentials');
      } catch (error) { fail(`Cannot complete public API/CORS checks (${error.name || 'network error'})`); }
    } else warn('No --api-url supplied; API/CORS probe not run');
  } else {
    warn('Live Apache, session/MFA, Paystack, PDF and authenticated browser workflows require staging tests');
  }
  output(`\nRESULT ${failures.length ? 'BLOCKED' : 'SOURCE/BUNDLE CHECKS PASSED'} — ${checks} checks, ${failures.length} failures, ${warnings.length} skipped scopes`);
  return { ok: failures.length === 0, checks, failures, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await run(parseArguments(process.argv.slice(2)));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(`QA configuration error: ${error.message}`);
    process.exitCode = 2;
  }
}
