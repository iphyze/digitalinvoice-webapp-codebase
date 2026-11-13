# DigitalInvoice — Step 10: frontend release gate and QA matrix

**Release status: not yet approved.** This document and `scripts/qaStep10.mjs` are QA tooling, not a claim that the application passed a production build or end-to-end validation.

## Automated commands

Use the **latest Step 9 frontend** plus this Step 10 patch. Node.js 18+ is required by the preflight; the application still uses its existing Vite dependencies.

```bash
node --test tests/qaStep10.test.mjs
DIGITALINVOICE_API_ROOT=/absolute/path/to/api node tests/applicationStep9.contract.cjs
node tests/platformCurrency.step9.contract.cjs
```

The source preflight checks Apache CSP, SPA routing, the theme bootstrap, the NRS evidence gate, ERP service and route guards:

```bash
# Use the locally corrected .htaccess that already has the two react-pdf exceptions.
node scripts/qaStep10.mjs --mode=source --csp-file=/absolute/path/to/corrected/.htaccess
```

**Known mismatch:** the supplied archived `public/.htaccess` is older than the owner's verified local copy: it is missing `script-src 'wasm-unsafe-eval'` and `connect-src data:`. Running the preflight without `--csp-file` against this archive intentionally fails those two checks. This patch **does not overwrite** the owner's corrected `.htaccess`. Ensure the corrected policy is the one Vite includes in `dist/.htaccess` before deployment.

Build and verify the output:

```bash
npm ci
npm run build
node scripts/qaStep10.mjs --mode=built --csp-file=/absolute/path/to/corrected/.htaccess
```

The built preflight still inspects `dist/.htaccess` independently. Passing a corrected source-file override cannot hide a stale policy shipped with `dist`.

After serving that **built** output through Apache (never just Vite dev server), run from a machine allowed to reach the deployment:

```bash
node scripts/qaStep10.mjs --mode=apache --url=https://STAGING-FRONTEND-HOST --api-url=https://STAGING-API-HOST/optional/api/base
```

This performs **unauthenticated GET-only** checks: SPA route fallback, Content-Security-Policy, script caching, public `/auth/config` and credentialed CORS headers. It does not log in or change any records. Both origins must be HTTPS; only loopback may use HTTP. **It does not verify actual PDF generation, Google login or Paystack checkout**, which require the manual scenarios below.

## Required manual browser matrix

Run with owner, administrator, accountant, basic user and platform roles as applicable; check role **and** plan restrictions. For every screen, verify loading, empty, 403, validation, 5xx/retry, mobile and dark theme. Do not use production customer data.

| Test group | Mandatory checks | Pass criteria |
|---|---|---|
| Auth and MFA | Password/Google sign-in, six-box paste/navigation, wrong TOTP, valid recovery code, exhausted/expired challenge, mandated enrolment QR/manual key, one-time codes, signed-out recovery flow | No guard bypass, no codes logged, no broken redirect or hidden security screen |
| Registration/invitations | Register, verify/check email, resend, reset-password and session revoke; team/platform invite validation and acceptance | Correct authenticated destination and enforced MFA; expired links never accepted |
| Organisation and catalogue | NRS profile IDs, customer postal/state/LGA, goods/service codes, type-change reset, manual unverified code | Values survive edit; manual code never mislabelled verified |
| Invoices | Draft/edit, approval, corrections, line classification snapshots, historical buyer address, credit/payment interactions | Approved snapshots immutable; local NRS validation distinguished from official evidence |
| Credit notes/delivery/proforma | Create from eligible approved source, partial quantity limits, approve/issue, archive/return, PDF/email/secure link | Workflow/permission gates and original invoice balances correct |
| Payments/customer portal | Receipt/allocate/void, currencies and customer matching, secure link expiry/revoke, portal NRS evidence gate | No over-allocation; revoked links denied; no sandbox QR presented as official |
| Reports/platform finance | Invoice/payment exports, aging/VAT 200-row cap, portal 80-link cap, per-currency plan/client/subscription totals | UI totals reconcile to database by currency; no mixed money sums |
| Platform/ERP | Plans/subscriptions/revenue, platform users, read-only API scopes, secret handling, delivery history, denied roles | Access checks match PHP, secrets shown once, webhook test status accurate |
| Overlay/interaction | Dropdowns in Team/Payments/Plans **modals**, drawers, toast/error alignment, date picker and six-box MFA controls | Dropdown above backdrop, options selectable, focus and keyboard accessible |
| PDF and CSP | Invoice, credit note, payment, proforma, delivery note and customer statement PDF after Apache deploy | No CSP errors; PDF opens and QR payload is unchanged |

### Viewports and accessibility

Test at **390, 768, 1024 and 1440px** in light and dark themes; check zoom up to 200%, Tab/Shift-Tab, Escape, visible focus, accessible names, reduced motion and content overflow. Verify the shared `Select` options in modals have correct z-index and are not covered by the backdrop. Test long names, empty results, and error text without changing column alignment.

### API and infrastructure boundaries

- Confirm actual `VITE_API_BASE_URL` and the API’s `ALLOWED_ORIGINS` agree with the deployed frontend. `https://api.digitalinvoice.ng` was proposed but must be confirmed by the deployment owner. Do not use a localhost fallback for a production build.
- The compiled frontend must use the **owner-corrected Apache `.htaccess`** with the PDF WASM/data exceptions. Never weaken this to generic `'unsafe-eval'` or broad `connect-src *`.
- Read and execute the backend companion `docs/STEP10-RELEASE-READINESS.md`, including migration and `--db` checks. ERP flags remain disabled until staging-approved, and live NRS submission is still unavailable.
- Never paste live email addresses, tokens, recovery codes, encryption keys or customer data into test logs/screenshots.

### Current environment results

Source-level checks pass except the **known stale archived CSP**; the new QA test suite correctly rejects it. Full `npm ci`/Vite build could not run because the offline cache lacks `zustand`. Browser, PHP/MySQL staging, Paystack and NRS/ERP HTTPS testing have **not** been completed. A release requires the remaining gates to pass in the deployment environment.
