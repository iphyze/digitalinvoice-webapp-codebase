# DigitalInvoice frontend changelog

**Append-only history:** Add a new dated section for each implementation step. Never overwrite, truncate or delete existing sections. This log begins when the NRS Steps 1–4 work started moving to the redesigned frontend; historical implementation details remain in `docs/BUILD-GUIDE.md` and `docs/HANDOVER.md`.

## 2026-11-06 — NRS frontend port · Step 0: contracts and security setup

### Added
- `src/services/mfaService.js`: MFA status, setup, confirmation, disable, recovery-code regeneration endpoints.
- `src/components/security/mfaCodeUtils.js`: pure six-box TOTP input helpers.
- `src/components/nrs/nrsEvidence.js`: production-verified NRS evidence gate with a required `verified_at` timestamp and all three identifiers.
- `public/theme-init.js`: prepaint theme bootstrap extracted from inline HTML so script CSP can remain strict.

### Updated
- `src/services/authService.js`, `api.js`, `firsService.js`, `creditNoteService.js`, `platformService.js`: ported MFA, submission queue, classification, readiness and sandbox-only integrations from the old frontend.
- `src/stores/useAuthStore.js` and `src/utils/appPaths.js`: MFA challenges, policy and mandatory-enrolment redirect path.
- `public/.htaccess`: CSP for approved API origin, Google Identity Services, Paystack and PDF blob workers, with clickjacking denial; explicit no-cache for the theme bootstrap.
- `index.html`: reference external blocking theme bootstrap (no visual redesign).
- `AGENTS.md` and `docs/BUILD-GUIDE.md`: clarified logic-sync exception, porting stages, deployment notes and Phase 1 plan.

### Scope and restrictions
- No JSX screen, route, layout, design token, permission or PHP backend code changed.
- `/security/mfa` route is **not** implemented in this step; it is reserved for Phase 1c. Do not deploy this partial migration to enforced-MFA users without the corresponding screen and guard.
- No package dependency added. NRS live submission remains disabled; there is no licence or production verification claim.
- Deployment must align CSP API origin with `VITE_API_BASE_URL` and smoke-test Google, Paystack and document/PDF generation.

### Step 0 correction — Apache CSP and local verification (2026-11-06)

- **User-verified:** `npm install` and `npm run build` both pass locally; the synchronized logic modules match the old frontend; and the external theme bootstrap runs correctly under the enforced CSP.
- **PDF CSP fix applied by the project owner to `public/.htaccess`:** react-pdf's WebAssembly layout engine requires `script-src 'wasm-unsafe-eval'`; its `data:` URL module load requires `connect-src data:`. With both allowances, PDFs download without CSP violations. Preserve these narrowly scoped exceptions when editing the deployment CSP. (These documentation-only corrections do not replace the owner's corrected `.htaccess`.)
- **Deployment validation rule:** test each CSP change with the **built `dist/` app served by Apache using the actual `.htaccess`**; the Vite development server does not enforce Apache's header. Check theme bootstrap, PDF download, Google Sign-In and Paystack with browser CSP reporting/console open.
- **API-origin confirmation:** `https://api.digitalinvoice.ng` is the proposed production API host, pending explicit confirmation. Once confirmed, ensure `VITE_API_BASE_URL` (including its `/api` path), CORS and the CSP origin allowances are consistent.
- No authentication UI, route, guard or backend implementation is included in this documentation correction.


## 2026-11-06 — NRS frontend port · Phase 1a: enforced authenticator enrolment

### Added
- `src/pages/security/MfaEnrollment.jsx` and `.module.css`: full-page protected MFA enrolment matching the redesigned frontend. Covers a passwordless Google account's first-password setup, normal current-password enrolment, centered SVG QR, copyable manual secret, 10-minute countdown, six-digit confirmation, sensitive errors/retries, one-time recovery codes, copy/download, and explicit saved-codes acknowledgement.
- `src/components/security/MfaCodeInput.jsx` and `.module.css`: reusable, accessible six-box TOTP entry; paste and autofill accept an entire code, arrow/backspace navigation is supported, numeric keyboard and validation feedback are provided.

### Updated
- `src/app/routes.jsx`: authenticated `/security/mfa` lazy route outside app, onboarding, subscription and platform layout guards.
- `src/app/guards/index.jsx`: mandatory MFA takes precedence over every other authenticated route; exempt only the enrolment route. When the policy is not enforced, a direct enrolment URL redirects to the normal authorized start path.
- `src/stores/useAuthStore.js`: session-expiry redirect recognizes `/security/mfa` as a protected path and returns users to sign-in on expiry.
- `package.json` and `package-lock.json`: `qrcode.react@^4.2.0` for scannable SVG QR codes, using the exact 4.2.0 lockfile metadata from the old frontend.
- `docs/BUILD-GUIDE.md`: guard/deployment rules, new component inventory and Phase 1a completion status.

### Security and boundaries
- The server remains authoritative for `mfa_policy`, MFA setup readiness, password verification, OTP validation, expiry and session revocation. No backend changes and no permission weakening.
- `PUT /user/password` revokes the Google-only user's session; the client clears local state and requires a new sign-in. Failed password attempts stay on the same form.
- `POST /user/mfa-confirm` revokes all sessions; recovery codes remain in in-memory component state until the user confirms they've saved them. The client then clears its session before navigating to login; no code/secret is persisted in browser storage.
- The CSP correction from Step 0 remains in the project owner's `.htaccess`. This patch intentionally does **not** include or override that file.
- This batch does **not** implement the Phase 1b MFA login challenge. Do not deploy forced MFA to production users until that step has been built and verified.

### Verification
- Source-level and syntax/contract checks are performed on the supplied snapshot. The project owner must run `npm install` and `npm run build` locally and browser-test against the real API; the npm registry is unreachable in this environment. No browser, database or enforced-Apache-CSP test is claimed.


## 2026-11-06 — NRS frontend port · Phase 1b: MFA on sign-in

### Added
- `src/components/security/MfaSignInChallenge.jsx` and `.module.css`: a shared two-step verification view for password login, Google login and Google-registration-to-existing-account. Uses the Phase 1a six-box TOTP input, a separate recovery-code entry mode, inline error feedback, time remaining, retry guidance and a prominent restart action. Only validated MFA completion leads to the workspace.

### Updated
- `src/pages/auth/Login.jsx`: interpret `mfaRequired` as an authentication step rather than an error; clear entered password, keep challenge only in React memory, and complete sign-in using `verifyMfa`.
- `src/pages/auth/Register.jsx`: support Google-initiated MFA challenge before accepting an existing account; retain the new-Google-user business-name dialog and prevent a mistaken failure toast during MFA.
- `src/stores/useAuthStore.js`: include server-provided `expires_in_seconds` when returning pending challenges and HTTP status on verification errors for precise handling. Do not apply a session until `verifyMfa` succeeds.
- `docs/BUILD-GUIDE.md`: register the shared component, mark Phase 1b source implementation, and document test/deployment gates.

### Constraints and verification
- No PHP API, guard, route, CSP, design token, permission or package dependency changed. The user's corrected `public/.htaccess` remains untouched.
- Challenge expiry is server-authoritative (five minutes); attempts are limited server-side (five per challenge). The client mirrors remaining attempts for guidance only and requires a fresh sign-in when a challenge is expired or exhausted. One-time recovery codes are never persisted.
- Test the full flow against the actual API and a built Apache-served app with enforced CSP, including light/dark/mobile and keyboard. Build/browser status must be reported from actual local checks; no NRS certification or live submission is implied.


## 2026-11-07 — NRS frontend port · Phase 1c: verification and registration hardening

### Updated
- `src/pages/auth/VerifyEmail.jsx`: honour the backend's `mfa_sign_in_required` response after verifying an MFA-enabled user. The server explicitly revokes the prior refresh session and does not issue a new one; clear local auth state and show **Sign in securely** instead of wrongly sending the user to subscription. No MFA session or challenge is created from email verification. Preserve the original verified-email message and subscription route for ordinary accounts; when `mfa_policy.enrolment_required` is true on a normal authenticated verification, offer the protected MFA-enrolment path first.
- `src/utils/validation.js`: match `POST /auth/register` field-length constraints for full name (120 Unicode code points) and business name (180 Unicode code points) before submitting. Existing password/email matching and on-submit/live revalidation remain intact.
- `src/pages/auth/Register.jsx`: if the optional **development-only** verification URL is malformed or lacks a token, fall back to `/check-email` instead of opening `/verify-email` with an empty token or throwing after a successful registration. The normal password and Google registration UX is unchanged.
- `docs/BUILD-GUIDE.md`: mark Phase 1c implemented and document the browser/API deployment test gate.

### Scope and verification
- Frontend only. No PHP backend, routes, guards, permissions, CSP, tokens, CSS, design or dependency changes. Do not overwrite the project owner's corrected Apache `.htaccess`.
- MFA email verification is intentionally **not** an MFA login challenge: users must complete sign-in and `/auth/mfa/verify` separately. The current backend contracts remain authoritative.
- Source parsing, imports and focused validation/contract checks can run offline. Full `npm install`/`npm run build`, live API integration and Apache-served light/dark/mobile/browser QA require local execution; no live integration verification is claimed here.


## 2026-11-07 — NRS frontend port · Phase 1d: invitations, recovery and session lifecycle

### Updated authentication flows
- `src/pages/auth/AcceptInvitation.jsx`: validate team invitation tokens against `GET /team/invitations/validate` **before** displaying the form, with loading/unavailable states and backend-supplied organisation/role details. `POST /team/invitations/accept` already creates a session: apply its authenticated payload and route via `resolveAuthenticatedStartPath()` instead of discarding it and forcing an unnecessary login. Enforced MFA still wins over workspace/subscription destinations.
- `src/pages/auth/AcceptPlatformInvitation.jsx`: preserve the platform invitation summary and token validation, but use the returned session's MFA-aware start path instead of blindly navigating to `/platform/dashboard`. Handle missing or now-unavailable invitations.
- `src/pages/auth/CheckEmail.jsx`, `Verification.module.css`: the resend endpoint requires an authenticated unverified user. Wait for session restoration; show sign-in guidance for guests, an already-verified continuation for verified accounts, and inline backend rate-limit/delivery errors without breaking the layout.
- `src/pages/auth/ForgotPassword.jsx`, `ResetPassword.jsx`: use `src/utils/developmentAuthLink.js` to extract only the approved local route/token from development-only links (no external URL navigation). Preserve generic forgot-password responses for unregistered emails. For reset, give an invalid/expired-token replacement-link state, keep normal validation errors inline, and clear stale local auth after server-side session revocation before returning to login.
- `src/utils/validation.js`: align team/platform invitation name length with the backend's 120-code-point maximum.

### Session restoration and guard-safe destinations
- `src/services/api.js`, `authService.js`, `src/stores/useAuthStore.js`: on an expired short-lived access cookie, use the existing HttpOnly refresh cookie and backend double-submit CSRF to recover the session before treating the user as a guest. Reuse one in-flight refresh request for automatic interceptor retries and explicit session restoration, because refresh credentials rotate on use. Deduplicate initialisation under React StrictMode. Refuse stale background updates after logout or account changes.
- `src/App.jsx`, `src/hooks/useSessionKeepAlive.js`: activate the existing activity-aware keep-alive hook for authenticated sessions, without polling on `/security/mfa` (the backend revokes sessions at MFA confirmation and one-time recovery codes must remain visible until saved). The backend is authoritative for idle/absolute expiry.
- `src/pages/auth/Login.jsx`, `src/utils/appPaths.js`: restore a deep link requested before session expiry **only** within the server-authorized workspace/platform area; mandatory MFA, verification, onboarding, subscription and individual route permissions continue to take precedence.
- Existing server logout (`POST /auth/logout`) and local-session cleanup remain unchanged. No route, permission, dependency, design token, backend, or CSP change. The project owner's corrected `.htaccess` was not overwritten.

### Verification and deployment gate
- JavaScript/JSX syntax parsed successfully and focused pure-helper contract tests passed. No full npm/Vite build, live backend/database run or browser/Apache CSP validation was performed in this environment.
- Locally test: valid/expired/missing/already-used team and platform invitations; privileged invitee redirected to `/security/mfa`; guest resend, authenticated resend, 429 cooldown, already-verified response; generic forgotten-password acknowledgment; valid/expired/reused reset tokens; logout after refresh; expired access with valid refresh cookie, expired refresh cookie, multiple concurrent 401s, focus/idle lifecycle, preserved deep links and no bypass of permissions. Test both themes, mobile and keyboard. Run `npm install` and `npm run build`, then repeat security and PDF smoke tests with the built app on Apache enforcing the owner's corrected CSP.
- Backend changes needed: none for the existing flows. Reset-link validity is checked by the backend when submitted; no separate token-preflight endpoint exists in this API.


## 2026-11-07 — NRS frontend port · Phase 2a / batch 1: Customer and Catalogue readiness

### Customer records
- `src/pages/customers/CustomerFormDrawer.jsx`: add `nrs_postal_zone`, `nrs_state_code` and `nrs_lga_code` to the existing Billing address section of both create and edit, using the redesigned TextField and Drawer design system. Persist these values in the existing customer create/update payload without adding a new endpoint or changing permissions.
- `src/utils/validation.js`: validate optional NRS postal zone at 20 characters and state/LGA codes at 100 characters each, matching the existing PHP customer route's maximum lengths. Validation continues to show on submit and update live thereafter.
- `src/pages/customers/CustomerDetails.jsx`: show stored NRS address codes beneath city/state so operators can verify what was saved. Missing codes remain represented by the existing neutral dash.

### Product & service catalogue
- `src/pages/catalogue/ItemFormDrawer.jsx` and `.module.css`: call `GET /firs/classification-codes?kind=goods|service` as the item type changes. If the API confirms a synced classification list with active entries, offer a searchable Select for the appropriate HS goods/service codes. Otherwise show an explicitly **unverified manual** code entry and a truthful resource-status message (loading, unavailable, no active entries, or pending sync). An explicit manual-entry action is also available alongside imported choices; previously saved codes absent from the current list are preserved and shown as manual, not silently lost or misrepresented as imported. Changing item type clears the prior NRS code, updates the FIRS item type and keeps the unit-of-measure selection valid.
- `src/pages/catalogue/ItemDetails.jsx`: label stored NRS codes as local records; this is not an NRS certification or submission status.
- Preserve existing FIRS mappings, reference APIs, customer/item save semantics, invoice quick-create drawer reuse, route permissions, light/dark tokens and mobile grid layout. No external designs, icon libraries, backend modifications or new npm dependencies.

### Contract and QA notes
- Read-only PHP API contract checked: customer NRS fields already exist on `POST/PUT /customers`; classification response has `{kind, source, verified, options}` at `response.data.data` and requires `catalogue.view`. All classification choices are local readiness values only; live NRS submission remains disabled.
- Source parsing, CSS parsing, import checks and focused validation/behavior checks are performed for this delivery; an authenticated browser/API smoke test and complete Vite build must be run locally. This patch does not include or overwrite the project owner's Apache `.htaccess` and its verified PDF CSP exceptions.
- **Next batch (not implemented):** invoice line classification display/snapshots, then overdue B2C queue warnings and remaining Phase 2a screens in the approved order.


## 2026-11-07 — NRS frontend port · Phase 2a / batch 2: invoice line classification and snapshots

### Invoice editor
- `src/pages/invoices/InvoiceEditor.jsx`: show each selected catalogue item's HS goods or service classification code and an explicit **local / NRS verification pending** note in the existing line item metadata. Missing codes display a clear instruction to update the catalogue; no classifications are auto-generated or represented as official approval.
- When editing an existing draft or rejected invoice, show the backend-returned `nrs_item_classification_snapshot` and `firs_item_type_snapshot` alongside the **current** catalogue value. If the catalogue value/type has changed, warn that saving the editable invoice refreshes that line's backend snapshot. Switching to a different catalogue item or using quick-create clears the old line's displayed snapshot to prevent stale code attribution.
- `src/pages/invoices/invoiceLineClassification.js` (new, logic only) normalizes classification display and snapshot comparison; `InvoiceEditor.module.css` styles the compact, responsive metadata without changing form layout or design tokens.

### Contract, security and QA
- The PHP API already snapshots `nrs_item_classification_code` and `firs_item_type` server-side in `invoiceCalculatePayload()` and persists them in `invoiceInsertLines()`. **The frontend does not send or allow editing snapshot fields.** Re-saving a draft recalculates snapshots using the then-current item; this is not immutable edit history. An approved invoice is not editable by the existing editor. No backend, permission, endpoint, dependency, route, document evidence or `.htaccess` changes.
- Focused JavaScript parser, CSS parser, imports, classification helper and payload-contract checks are included in the delivery verification. Full `npm install`/`npm run build` and browser/API testing must be completed locally. In particular, test goods/service items with and without codes, previously saved snapshots that match/differ from catalogue, item replacement, quick-create, save/reopen, rejected invoice edits, dark/light/mobile and Apache-served CSP/PDF smoke tests.
- Next batch, **not implemented here**: invoices-list overdue B2C reporting warnings and queue count.


## 2026-11-07 — NRS frontend port · Phase 2a / batch 3: invoices-list B2C deadline and queue indicators

### Updated
- `src/pages/invoices/Invoices.jsx` and `.module.css`: display an organisation-wide warning when the internal NRS queue reports B2C invoices beyond the **24-hour reporting deadline**. Include explicit dry-run/no-live-transmission wording, a loading state, a retryable unavailable state and a manual refresh button. The warning is independent of the invoice list's filters and pagination.
- Add a **NRS local queue** column and matching mobile-card section. Approved invoices present in the returned queue records show B2B/B2C kind, internal status, dry-run preview indicator and B2C deadline in backend-server time; overdue B2C jobs stand out. Non-approved invoices are labelled as awaiting approval.
- `src/pages/invoices/invoiceQueueStatus.js` (new, UI-free): parse and validate the existing backend queue contract, map records to invoice IDs without overwriting newer jobs, and derive neutral/warning/error presentation text. The endpoint returns at most 100 individual queue jobs; if an approved invoice is not represented, the UI says **Not in recent queue**, not “not queued.” Any failed/unexpected response hides the count instead of claiming zero overdue jobs.
- `docs/BUILD-GUIDE.md`: record the queue's exact data limits, display rules and manual test gate; update Phase 2a build status.

### Security, boundaries and QA
- Uses existing `firsService.submissionQueue()` (`GET /firs/submission-queue` requiring `invoices.view`), and does not modify submission or reporting state. The overdue count is authoritative only for the organisation's *internal queue* as of the last request. The backend advertises `mode: dry_run` and `external_submission_enabled: false`; **none of this is NRS receipt, certification, clearance or live reporting**. No official NRS identifier/QR is rendered.
- The frontend phase does not modify the backend, permissions, navigation, design tokens, package dependencies or the project owner's corrected `public/.htaccess`. No new shared UI components were necessary.
- Syntax, import and focused helper/contract tests were performed offline. The complete npm/Vite build and authenticated browser/API + Apache CSP tests remain for local verification.


## 2026-11-07 — NRS frontend port · Phase 2a / batch 4: document/PDF NRS evidence and customer portal

### Updated
- `src/components/documents/documentModels.js` now attaches the backend's optional `nrs_evidence` to invoice, credit-note and payment receipt models. Document models remain the single source for the on-screen sheet, browser print and downloaded PDF. The API's `proforma_invoice` type is also recognised by the customer-portal model lookup.
- `src/components/documents/DocumentSheet.jsx` and `src/components/nrs/NrsDocumentEvidence.jsx` / `.module.css` render a compact on-paper status panel: neutral **Not yet submitted to NRS** for missing or nonproduction evidence; official IRN, CSID and scannable QR only for fully verified production evidence. QR uses the backend's opaque `qr_payload` without regeneration or substitution. Fixed paper styling is intentional in both themes and for print.
- `src/components/documents/pdf.jsx` and `src/components/nrs/NrsPdfEvidence.jsx` render the same gate and identifiers in PDF, with vector paths from the existing `qrcode.react` SVG encoder. The PDF-only text normaliser now leaves the entire NRS evidence object unchanged, preserving the exact signed QR content. The PDF library is still lazy-loaded.
- The existing `src/pages/portal/CustomerPortal.jsx` automatically gets the new status block through its shared document model and renderers; no standalone markup or extra API requests were added.

### Security, backend limitation, verification
- Backend remains read-only. Authenticated document endpoints already attach `nrs_evidence`, but the **public customer portal** currently uses `customerPortalDocumentPayload()` which omits this property. To display verified identifiers publicly in future, a separately approved backend change must attach organisation-scoped `nrsDocumentEvidence()` after checking link validity and access. Until then, portal screen/PDF correctly display the neutral notice. No backend route, permission, dependency or CSP change was made.
- Source checks were run for the files changed in this batch; a complete Vite build and live browser/API/Apache verification remain for local testing. Test all three supported document types with empty/sandbox/partial/verified production evidence, screen-to-PDF parity, long identifier wrapping, QR scanning and strict payload equality, the portal, browser print, and unchanged proforma/delivery docs in both themes and mobile. Preserve the user's Apache CSP PDF allowances (`script-src 'wasm-unsafe-eval'` and `connect-src data:`).


## 2026-11-07 — NRS frontend port · Phase 2a / batch 5: Organisation settings and issuer compliance profile

### Organisation settings (replaces placeholder)
- New `src/pages/settings/OrganizationSettings.jsx` with a responsive, token-based CSS Module and five existing backend-backed sections: Business profile, Invoice defaults (including local FIRS/NRS defaults), Compliance, Payment accounts and Branding. The route remains `/app/settings/organization` behind the existing `organization.manage` permission and `organization_settings` entitlement; guards and navigation are unchanged.
- Business/invoice/compliance updates continue to use the existing `onboardingService` endpoints. The invoice-default form retains the backend's additional FIRS defaults when editing, instead of overwriting them. Resource codes are suggested using `GET /firs/options` when available, with stored-value fallbacks when unavailable. VAT, document-type consistency and business details are validated before submission.
- Payment accounts use existing create/edit/delete endpoints, the redesigned Drawer and a removal confirmation; logo management uses the existing upload/remove API and an authenticated, revocable blob preview. Archived-workspace account deletion is **not** in this NRS compliance batch and will need a separately approved destructive-action workflow.

### NRS issuer details in both flows
- Add the five existing backend fields — `nrs_business_id`, `nrs_service_id`, `nrs_postal_zone`, `nrs_state_code`, `nrs_lga_code` — to the redesigned onboarding compliance step and Organisation Settings. `NrsIssuerFields` is a shared visual-only component using existing TextField controls, Sora/tokenized styles and responsive parent grids. Edit/update payloads preserve the five values.
- `src/utils/validation.js` now enforces the PHP contract: optional UUID with permitted version/variant for business ID (max 36); optional 8-character alphanumeric service ID; postal zone max 20, state and LGA codes max 100. None are required before NRS issues them. The backend-provided NRS/MBS status and integration environment are shown **read-only**; they are never submitted by the browser. Clear neutral language explains that setting identifiers does **not** imply certification, licence or live submission.
- `src/pages/settings/organizationSettingsModel.js` normalizes GET records to form values and constructs the invoice-settings PUT payload. No backend, CSP, or npm package change. The project owner's corrected `.htaccess` must be retained.

### Verification and release checks
- Parsed changed JavaScript/JSX and verified module paths and backend route/field mapping by source inspection; no authenticated browser/database checks or complete Vite build are claimed. The production bundle still needs `npm install` + `npm run build` and an Apache `.htaccess` CSP smoke test, including PDF downloads.
- Test organisation settings permission/entitlement enforcement; business and invoice defaults editing; FIRS resource list available/unavailable; B2B and B2C defaults; all five compliance fields retained after save and reopen; malformed NRS UUID/service IDs and overlength address values; empty NRS identifiers; VAT confirmation; bank create/edit/remove/default; logo upload/replace/remove; onboarding compliance save/continue; both themes, mobile, keyboard, and network failures.
- Existing pending backend task from batch 4: add appropriately scoped read-only `nrs_evidence` to customer-portal document payload after separate approval. No further backend change needed for batch 5.


## 2026-11-07 — NRS frontend port · Phase 2b / batch 1: Invoice Details

### Added
- `src/pages/invoices/InvoiceDetails.jsx` and `.module.css`: redesigned invoice details page with skeleton/unavailable/error states, responsive document summary, stored customer and line classification snapshots, saved history/allocations, full invoice breakdown, permission-controlled approval workflow, print/PDF output and customer email delivery.
- `src/pages/invoices/invoiceDetailsModel.js`: UI-free local UBL response parser, safe monetary and filename formatting, snapshot labels and send-email validation.
- `src/components/nrs/NrsUblReadinessPanel.jsx`, `NrsQueueStatus.jsx` and `NrsReadiness.module.css`: offline UBL v1.1 preflight error/warning remediation, dry-run per-invoice queue/deadline with server-time labels, retry/error states and unambiguous non-submission wording.
- `src/pages/invoices/InvoicePaymentDialog.jsx`, `InvoiceSecureLinkDialog.jsx`, `InvoiceDialogs.module.css`: invoice-scoped record/allocate payment, and customer-portal secure-link create/copy/revoke/list workflows via existing backend APIs; no new permissions.
- `src/pages/invoices/invoicePrint.css`: isolated paper-only browser printing; PDF uses the existing lazy shared renderer and production-evidence gate.

### Updated
- `src/app/routes.jsx`: replace the `/app/invoices/:id` placeholder with lazy `InvoiceDetails` inside the unchanged `invoices.view` route guard.
- `docs/BUILD-GUIDE.md` and `design/README.md`: add four new component entries, the Invoice Details design/route/permissions/API/print test guidance, a reference-only design note, and update the Phase 2b build status.

### Boundaries and QA
- Backend read-only, no new dependency, no CSP replacement. NRS queue remains dry run; local schema validation is not a licence or live clearance. Display IRN/CSID/QR only under `hasProductionNrsEvidence`; otherwise show **Not yet submitted to NRS**. The separately pending public portal `nrs_evidence` change from Phase 2a batch 4 remains outstanding.
- Source syntax/import/CSS and focused helper/contract checks pass offline; full `npm install`/`npm run build`, browser flows, Apache CSP print/PDF and live authenticated tests require local verification. Next Phase 2b batch: Credit Note Details.


## 2026-11-07 — NRS frontend port · Phase 2b / batch 2: Credit Note Details

### Added
- `src/pages/creditNotes/CreditNoteDetails.jsx` and `.module.css`: replace `/app/credit-notes/:id` placeholder with responsive details, loading/unavailable/retry, source invoice and balance, credit reason/lines/tax, customer snapshot, history, approval actions, output preview, PDF/print, customer email and secure link.
- `src/pages/creditNotes/creditNoteDetailsModel.js`: pure credit-note status/readiness/validation helpers. The NRS readiness response is **not persisted** by PHP, so the screen holds the returned `ubl_validation` only until refresh or navigation.

### Updated
- `src/app/routes.jsx`: lazy Credit Note Details within existing `credit_notes.view` permission and app guards; list and create/edit routes remain placeholders for later batches.
- `src/pages/invoices/InvoiceSecureLinkDialog.jsx`: retain invoice behavior and add optional `document` + `documentType` arguments for credit notes; the link API now receives `document_type='credit_note'` for credit-note links. The one-time URL remains visible after refreshing the link list.
- `src/components/nrs/NrsUblReadinessPanel.jsx`: add optional title and document-label props so the same offline UBL panel accurately describes credit notes; invoice defaults unchanged.
- `docs/BUILD-GUIDE.md` and `design/README.md`: record the component, route, API/permission contract and local deployment test gate.

### Security, contracts and verification
- No licence, live NRS transmission or clearance is claimed. Production QR/IRN/CSID are still gated via the existing `hasProductionNrsEvidence`; dry-run and missing evidence show **Not yet submitted to NRS**. No credit-note queue is invented, because the existing queue is invoice-scoped. The backend is read-only; no new dependencies; do not overwrite the owner's Apache `.htaccess`.
- Source syntax, import/CSS checks and pure-helper/contract tests are performed offline where available. Full `npm install`/`npm run build`, authenticated backend/database flows, real email sending, browser print/PDF/QR and Apache CSP testing must be verified locally. Pending backend request from Phase 2a / batch 4 remains the public customer-portal read-only evidence extension.


## 2026-11-07 — NRS frontend port · Phase 2b / batch 3: Credit Notes listing and editor

### Added
- `src/pages/creditNotes/CreditNotes.jsx`: replace the register placeholder with an Invoice/Customers-pattern list: server-side search/status/date filters, scoped KPI cards, responsive table and mobile cards, pagination, permission-gated edit/archive actions and archive confirmation.
- `src/pages/creditNotes/CreditNoteEditor.jsx` and `.module.css`: add approved-source invoice selection with server search, preselected invoice links, returned/draft editing, remaining-credit quantities with accessible checkboxes/inputs, reason/category/notes, estimate-only sidebar and save/optional submit actions. Uses the Invoice Editor's CSS Module and shared forms; no old CSS/markup/components copied.
- `src/pages/creditNotes/creditNoteEditorModel.js`: response adapters, draft hydration, sourced line-state merging, validated four-decimal quantities and backend-shaped draft payload. No client amount/tax override.

### Updated
- `src/app/routes.jsx`: lazy-loaded list/create/edit screens under the **existing** `credit_notes.view/create/edit` permission guards; no permission or route address removed.
- `docs/BUILD-GUIDE.md` and `design/README.md`: component/route contracts, UI references, QA/deployment gate and known backend permission dependency.

### Constraints / verification
- Backend is unchanged; verified-production-only NRS evidence remains in the shared document system. Credit Notes list/edit is not itself NRS transmission. No new dependencies; `.htaccess` remains the project owner's Apache CSP-corrected version.
- `GET /credit-notes/source-invoice` requires `credit_notes.create`, including for existing-note editors, and invoice selection requires `invoices.view`; roles granted `credit_notes.edit` without `credit_notes.create` (or create without invoices.view) need a separately approved backend read-permission adjustment. The UI presents authorization failures without bypassing the API.
- Source syntax, imports, CSS and model contract checks are possible in this workspace. Full npm build, browser/API/database integration and built-Apache CSP checks must be performed locally; no visual browser QA is claimed.


## 2026-11-07 — Redesigned frontend · Phase 2b / batch 4: Proforma invoices

### Added
- `src/pages/proformaInvoices/ProformaInvoices.jsx`: approved Customers/Invoices list design: five labelled, scoped KPIs, server-side search/status/issue-date filtering, pagination, desktop table/mobile cards and permission-gated draft editing/archiving. No speculative global totals or conversion action.
- `src/pages/proformaInvoices/ProformaEditor.jsx`: invoice-editor patterned draft/issue form, customer/catalogue/bank quick-create drawers, item pricing/quantity/tax/discount, dates, payment terms, sticky local estimate and explicit irrevocable issue confirmation. Proforma numbers and final amounts come from PHP. Only drafts are editable.
- `src/pages/proformaInvoices/ProformaDetails.jsx`: same responsive card/paper hierarchy as Invoice and Credit Note Details, issued-only print/PDF/email/secure links, delivery history, draft archiving and reliable loading/error states. Uses shared `DOCUMENT_TYPES.proforma`, `DocumentSheet` and lazy PDF renderer. No NRS IRN/CSID/QR for proformas.
- `src/pages/proformaInvoices/proformaModel.js`, `Proforma.module.css`: UI-free request/response adapters, draft hydration, input checks, filename/email validation and minimal token-based supplementary styles.

### Updated
- `src/app/routes.jsx`: activate `/app/proforma-invoices`, `/new`, `/:id` and `/:id/edit` under existing `proformas.view/create/edit` guards.
- `src/pages/invoices/InvoiceSecureLinkDialog.jsx`: human-readable proforma label for `documentType='proforma_invoice'`, keeping invoice and credit-note behavior unchanged. Backend already supports issued proforma portal links.
- `docs/BUILD-GUIDE.md`, `design/README.md`: record UI/UX reference, API contracts and regression tests.

### Scope / security / QA
- Proforma invoices are commercial proposals, **not** approved tax invoices or a live NRS submission. There is no invented NRS clearance, invoice conversion endpoint or approval state. PHP stays read-only; Apache CSP configuration unchanged; no new npm dependencies.
- Source syntax, relative imports and CSS-class checks plus focused model and route contracts are verified offline. Full Vite bundle, authenticated API/database and browser/PDF/Apache CSP checks must be verified locally. Pending backend task from Phase 2a/Batch 4 remains optional read-only NRS evidence on public invoice/credit-note/receipt portal payloads; no new backend change identified for proformas.


## 2026-11-07 — Redesigned frontend · Phase 2b / batch 5: Delivery Notes and navigation visibility

### Navigation audit and correction
- Audited `src/app/routes.jsx`, `src/config/navigation.js` and `src/app/layouts/AppShell.jsx`. The list destinations for Credit Notes, Proforma Invoices and Delivery Notes were **already** configured under Sales; the latter was a placeholder. Their visibility depended on opening Sales and on role/plan filters. New/edit/details URLs are linked from their register pages rather than duplicated in the sidebar.
- `AppShell.jsx`: Sales starts expanded in the full desktop sidebar and the mobile Sales tab now opens a keyboard-accessible Sales-only link sheet rather than redirecting straight to Invoices. Preserved collapsed-rail fly-outs, More navigation, breadcrumb behavior, permissions, entitlements, and theme tokens. Hidden links from an ineligible role/plan are not exposed.

### Added
- `src/pages/deliveryNotes/DeliveryNotes.jsx`: replace the register placeholder with search/status/date filters, URL-synced server pagination, scoped KPIs, responsive DataTable/mobile cards and permission-gated edit/archive draft controls.
- `src/pages/deliveryNotes/DeliveryNoteEditor.jsx`: approved invoice search, server-provided remaining deliverable quantities, selectable partial deliveries, clear validation/errors, Save draft and irreversible Issue confirmation. Reuses existing Invoice Editor panels and shared forms.
- `src/pages/deliveryNotes/DeliveryNoteDetails.jsx`: customer/invoice snapshot, delivered quantities, draft/issued status, document paper preview, issued-only print/lazy PDF/email delivery and secure portal links; delivery history and archive draft. Reuses `DOCUMENT_TYPES.delivery_note`, `DocumentSheet`, existing PDF renderer and print styles.
- `src/pages/deliveryNotes/deliveryNoteModel.js` and `DeliveryNotes.module.css`: pure backend contract adapters/validators and small token-based screen styles.

### Updated and boundaries
- `src/app/routes.jsx`: replace only the Delivery Notes list/new/details/edit placeholders with lazy screens under the **existing** permissions and guards. Existing menu destinations in `src/config/navigation.js` remain the source of truth and did not require path changes.
- `docs/BUILD-GUIDE.md` and `design/README.md`: delivery contract, updated navigation UX, controls/permissions, QA gates and UI/UX references.
- Backend and CSP remain unchanged; delivery notes are not NRS tax invoices or NRS submission evidence. No new dependencies. Backend limitation: `GET /delivery-notes/source-invoice` requires `delivery_notes.create`, including when editing a draft with only `delivery_notes.edit`; plan a separate approved backend read-permission correction. The previously pending customer-portal NRS evidence adjustment remains pending.
- Offline parsing/import/CSS/model tests can run; full Vite build is unavailable here (`vite: not found`). Browser, API/email/PDF and built Apache CSP tests require project-owner local verification.


## 2026-11-07 — Redesigned frontend · Phase 2b / batch 6: Payments list and receipt details

### Added
- `src/pages/payments/Payments.jsx`: replace Payments register placeholder with server-side receipt search/status/method filters, URL-synced pagination, truthful global-total + current-page status KPIs, desktop and mobile DataTable, loading/empty/error/retry and permission-gated recording.
- `src/pages/payments/PaymentRecordDialog.jsx`: record customer receipts using the existing payment service and async customer search, currency-specific optional bank accounts, date/money validation and an explicit unallocated-first workflow. New receipts open directly in Payment Details.
- `src/pages/payments/PaymentDetails.jsx`: receipt/customer/bank details and active/reversed invoice allocations, audit history, printable shared payment document, lazy PDF, template/PDF email and portal links; permission-gated allocation and irreversible void with required reason.
- `src/pages/payments/PaymentAllocateDialog.jsx`: eligible outstanding invoices for the same customer/currency, multiple unique allocations with two-decimal validation and no client-side settlement override. The PHP backend performs the authoritative transaction and recalculates invoice balances.
- `src/pages/payments/paymentModel.js` and `Payments.module.css`: pure API/validation/status helpers, integer minor-unit money checks, receipt file naming, and responsive design-token-only supplementary styling.

### Updated
- `src/app/routes.jsx`: replace Payments list and details placeholders with lazy screens. Keep `payments.view` parent guard, all other routes, menu/permission filtering and subscription checks unchanged. Payments menu already points to `/app/payments`.
- `docs/BUILD-GUIDE.md`, `design/README.md`: component table, backend API contract, implementation order, UI references and deployment/QA instructions.

### Constraints and verification
- The backend and corrected Apache `.htaccess` remain unchanged. No new dependencies and no claim of licensed or live NRS submission. The receipt uses the existing production-only NRS evidence gate; missing or sandbox evidence stays neutral. Public customer-portal evidence remains pending an independently approved backend change.
- Source-level JSX/JavaScript parsing, imports, CSS-class checks and focused payment model/route-contract tests are intended for this batch. Full npm Vite build, browser/UI review, authenticated PHP/database behavior, email, print and QR scanning must be checked locally; no such runtime result is claimed in this changelog.
- Read-only `payments.view` without `invoices.view` can view receipts; an allocator with `payments.record` but without `invoices.view` cannot load eligible invoice options via `GET /invoices/outstanding`. Preserve the backend's permission response and request a separately approved backend permission policy review if that role arrangement is desired.


## 2026-11-07 — Redesigned frontend · Phase 2b / batch 7: Customer portal link management

### Added
- `src/pages/portalLinks/CustomerPortalLinks.jsx`: replace the `customer-portal` workspace placeholder with a secure-link management register. Five scoped summary cards, local search/type/status filters over the backend's latest 80 links, URL-synchronised client-side pagination, responsive DataTable/mobile cards, loading/empty/API-error/retry states, refresh, source-document navigation where the user has that document's view permission, and confirmation before revocation.
- `src/pages/portalLinks/portalLinkModel.js`: UI-free response checks, server-flag-driven Active/Expired/Revoked statuses, local filtering and counts, permission-aware source-document paths. Never invent or reconstruct the secret URL from list records.
- `src/pages/portalLinks/CustomerPortalLinks.module.css`: small responsive/token-only additions over the existing Invoice register styling.

### Updated
- `src/app/routes.jsx`: activate `/app/customer-portal` under the **existing** `portal_links.manage` permission/entitlement guard. The Customer Portal sidebar and mobile Sales entry already exists, so no navigation-config or permission change is needed.
- `docs/BUILD-GUIDE.md` and `design/README.md`: register component contract, source-only UI pattern, backend limits, permissions and QA/deployment checks.

### Security, data accuracy and verification
- `GET /portal-links` returns only the **latest 80 links**, without tokens or `portal_url`; the dashboard explicitly calls all counts *recent-link* metrics, not total organisation figures. Statuses come from backend flags and update on refresh. Local search/filter/pagination never pretends to query all historical links. Link creation and one-time URL copy continue on each original document's existing `InvoiceSecureLinkDialog`; issued/approved document statuses are validated by the PHP backend. Never display a guessed or re-created private URL.
- `POST /portal-links/revoke` requires `portal_links.manage`, is protected by a destructive-action confirmation and returns the updated link. Revoked/expired links cannot be revoked from the UI, and revocation does not create replacement links. Document navigation additionally checks its own view permission; the destination guard continues to check plan entitlements.
- Backend and the owner-corrected Apache `.htaccess` stay unchanged. No new npm packages. This screen is a platform sharing feature, not NRS submission or clearance. The separately tracked public customer-portal NRS evidence backend extension is still pending.
- Source parse/import/CSS and focused model/route assertions can be checked offline. Complete Vite build, authenticated PHP/database and browser/UI tests require local verification; no such test is claimed unless actually run.


## 2026-11-07 — Redesigned frontend · Phase 2b / batch 8: Workspace Dashboard

### Added
- `src/pages/dashboard/Dashboard.jsx` and `.module.css`: replace the workspace dashboard placeholder with backend-driven financial cards, period/currency filter form, invoice and payment history, recent activity, locally reported NRS awaiting-submission count and conspicuous regulatory disclaimer. Filters use the existing `dashboardFilters` presets and validate valid dates and the PHP three-year limit before requesting data.
- `src/pages/dashboard/DashboardTrendChart.jsx`: lazily loaded Recharts graph of approved invoice totals and payments received, with an accessible table of the same values and themed tooltip. The chart library is not pulled into the main app/dashboard shell chunk.
- `src/pages/dashboard/dashboardModel.js`: pure response-shape checks, daily/monthly series adapters, display formatters and date-range validation; errors are not misrepresented as empty or zero-valued data.
- `src/components/data/StatCard.jsx` and `.module.css`: reusable token-only KPI card following the approved Customers Sample A / Invoice register visual language; accepts an icon, label, value, note, tone and loading skeleton.

### Updated
- `src/app/routes.jsx`: lazy-load Dashboard at `/app/dashboard` in the existing `dashboard.view` PermissionRoute. Sidebar/mobile Dashboard links already point to it; no new permission, entitlement or menu changes.
- `docs/BUILD-GUIDE.md` and `design/README.md`: component inventory, implementation sequence, API contracts, UI pattern and QA/deployment checks.

### Data accuracy, security and QA
- `GET /dashboard/summary`, `/dashboard/trends`, `/dashboard/recent-activity` remain read-only and are all authorised by `dashboard.view`. Summary amounts refer to the selected period and one selected currency. Active customer/item counts are all-time organisation-wide; recent activity is the latest across all dates. Outstanding/overdue figures are derived by the backend from approved invoices dated within the selected period, not the entire ledger. The collection-rate denominator is approved invoice value for that same period.
- Individual endpoint failures are displayed separately, not converted to a fabricated zero. The summary must pass response-shape checks before KPI rendering. The NRS tile counts internal approved records awaiting integration only; no live NRS submission, certificate, clearance, licensed status or production evidence is inferred. Shortcuts remain filtered by user permissions and plan entitlements.
- The backend, existing service contract, package dependencies and owner-corrected Apache `.htaccess` remain unchanged. Source syntax/import/CSS and focused model/API-contract checks may be performed offline; the complete Vite build, authenticated API/data behavior, keyboard chart use, mobile/light/dark and deployed Apache CSP require local testing and must not be represented as verified unless run.

## 2026-11-07 — Redesigned frontend · Phase 2b / batch 9: Reports hub and six reporting screens

### Added
- `src/pages/reports/Reports.jsx`: the redesigned Reports hub with all six reporting destinations. The existing Reports menu already includes those paths and remains governed by `reports.view` and the active plan's reports entitlement.
- `src/pages/reports/ReportRegister.jsx`, `ReportFilters.jsx`, `InvoiceRegister.jsx`, `PaymentRegister.jsx`, `ReceivablesAging.jsx`, `VatSummary.jsx`: source-implemented financial reporting with independently applied date/currency/status/search filters where supported, PHP-compliant three-year maximum date spans, scoped KPI totals, desktop/mobile tables, server pagination for registers and explicit no-results/API-error/retry behavior. PDF/export claims are not applied to backend-limited records.
- `src/pages/reports/CustomerStatement.jsx`, `statementPdf.jsx`: customer search and exact `customer-statement-v1` response handling, opening balance, approved invoices/credit notes/non-void receipts, chronologically ordered transactions and closing balance; CSV, lazy XLSX, lazy Sora/Inter PDF and permission-gated template/PDF email using `reports.send` and the existing 4 MiB server attachment limit. Email uses the filters from the generated statement, not unsubmitted form edits.
- `src/pages/reports/ComplianceReadiness.jsx`: read-only profile completeness, internal integration status, counts and latest twenty approved invoices awaiting future integration. Never confuses database status with NRS licence, clearance or production evidence; mixed-currency totals are intentionally not added.
- `src/pages/reports/reportModel.js`, `Reports.module.css`: UI-free backend response contracts, date/filter helpers, CSV injection-resistant exports and token-based responsive styling matching the new Customers/Invoices/Dashboard patterns. No old markup, CSS or animation library was copied.

### Updated
- `src/app/routes.jsx`: replace all seven report placeholders with lazy-loaded screens inside the existing `reports.view` PermissionRoute; keep sidebar paths, platform/subscription/onboarding guards and all other routes unchanged.
- `docs/BUILD-GUIDE.md` and `design/README.md`: component inventory, reporting contract limitations, build order and browser/Apache deployment test checklist.

### Accuracy, permissions and QA
- Invoice and payment reports are server-paginated; summary totals refer to all matching records while CSV downloads contain **only the visible page**, plainly labelled. Receivables aging and VAT invoices return **at most 200 detail rows**, even when summary totals cover more. Aging is based on today's stored outstanding balances relative to the requested date, **not** a historical reconstruction. Compliance readiness is organisation-wide and does not sum different currencies. Customer statements are scoped to one customer, one currency and a maximum of three years.
- All report routes require `reports.view`, while sending customer statements also requires `reports.send` and a reports entitlement. Direct links to invoices, credit notes or payments appear only with the corresponding view permission and plan entitlement. No new backend endpoint, npm dependency or Apache CSP change; existing PHP remains read-only. No live NRS submissions, certification or regulatory validation is implied.
- Offline source/syntax/import/CSS and contract assertions can be verified locally in this workspace; complete Vite build, real PHP/data/email/PDF execution, accessibility, mobile, theme and Apache CSP tests remain for owner-run QA. Do not treat source checks as browser validation. Pending unrelated backend items (portal NRS evidence response and source-invoice edit-only permission gaps) are unchanged.


## 2026-11-07 — Redesigned frontend · Phase 2b / batch 10: Workspace administration registers

### Added
- `src/pages/team/TeamMembers.jsx`, `teamModel.js`: member/invitation register, search, pending invitations, invitation creation/resend/cancellation and role/active-status management, with server-owned assignable roles and session-revocation notice. Role/status and cancellation actions require confirmation. Account manager restrictions are enforced on both frontend and backend.
- `src/pages/admin/TaxRates.jsx`, `taxRateModel.js`: tax-rate register, default/inactive flags, filtering and the existing reference create/update contract, with backend-aligned code, treatment and percentage validation. Deactivation warns about items still using the tax rate.
- `src/pages/admin/ActivityLog.jsx`, `activityModel.js`: timestamped searchable audit-event list, server group/date/page filters and last-30-day summary; no sensitive raw metadata display.
- `src/pages/admin/AdminRegister.module.css`: shared register/forms styling following new Customers Sample A visual conventions, both themes and mobile layout.

### Updated
- `src/app/routes.jsx`: activate the **existing guarded** `/app/team`, `/app/settings/tax-rates`, `/app/activity-log` addresses. Navigation config already has all three entries; no new menu or permission rule is required.
- `docs/BUILD-GUIDE.md`, `design/README.md`: component contracts, updated build order, backend limits, permission behavior and local QA checklist. Changelog previous sections retained.

### Contract, security and testing notes
- The PHP backend and all services/stores are unchanged. Team writes require `requireTeamManager()`; the UI additionally checks the signed-in role and actor/target restrictions, but the server remains the final authority. Role and active-status updates revoke existing sessions. Invitations use the server's expiring tokens; no stored invitation URL is reconstructed.
- Tax code syntax, treatments, numeric percentages, active/default constraints and “assigned to active items” deactivation restriction follow the PHP route. Activity table data is server-paginated; last-30-day metrics are intentionally not filtered by the table query. No NRS clearance or tax submission is inferred.
- No new npm dependencies, no Apache CSP alteration, no backend change. Source import, syntax, CSS and focused model checks are performed separately from the full Vite build. Live PHP/session/permission, interactive browser, mobile and Apache CSP testing still require local verification. Profile/MFA account settings remain for the next batch.


## 2026-11-07 — Redesigned frontend · Phase 2b / batch 11: Workspace Profile and MFA security

### Added
- `src/pages/settings/Profile.jsx`, `Profile.module.css`, `profileModel.js`: functional `/app/profile` with read-only account/identity information, full-name editing, backend-compatible password create/change, and security card. Uses redesigned panels and existing shared fields, alerts and buttons (not the old frontend design).
- `src/components/security/MfaSecurityCard.jsx`, `MfaSecurityCard.module.css`: workspace authenticator status, voluntary enrolment with QR and manual key/expiry, six-digit TOTP verification, one-time recovery code save/copy/acknowledgment, regeneration and policy-limited disable with current password plus TOTP/recovery code. Shared component can be reused on the future platform Profile.

### Updated
- `src/app/routes.jsx`: replace the workspace profile placeholder with the lazy-loaded screen at the existing `/app/profile` path. Keep all guards/permissions and other routes unchanged; account menu already includes the profile link.
- `src/hooks/useSessionKeepAlive.js`: don't refresh a revoked session while one-time MFA recovery codes are visible in the workspace Profile. Forced `/security/mfa` already has a similar restriction.
- `docs/BUILD-GUIDE.md` and `design/README.md`: component registry, implementation order, security contracts and visual QA notes.

### Security and verification
- The PHP backend stays read-only; `GET/PUT /user/profile` and `PUT /user/password` are preserved. Password changes and MFA confirmation/disablement clear server auth cookies and revoke sessions; regeneration does not revoke sessions but invalidates previous recovery codes. After MFA confirmation, codes remain in memory until explicitly acknowledged and the session is then cleared. Privileged accounts are not offered disable controls, and the server independently denies those actions.
- No new npm dependency or `.htaccess` change. The owner's `script-src 'wasm-unsafe-eval'` and `connect-src data:` exceptions remain untouched. No NRS production or licensing claims. Source-level checks must not be represented as a Vite/browser/Apache deployment test.


## 2026-11-07 — Redesigned frontend · Phase 2b / batch 12: Platform dashboard, clients and users

### Added
- `src/pages/platform/PlatformDashboard.jsx`: actual `GET /platform/dashboard` metrics, recent clients, subscriptions, payments and activity. All revenue amounts use the server's NGN subscription data and MRR is labelled an estimate. Client invoice turnover and NRS status are not inferred.
- `src/pages/platform/PlatformClients.jsx`, `PlatformClientDetails.jsx`: filters, responsive register, profile, members, subscription/payment and activity history, and safeguarded account activation/suspension/archive actions with explicit revocation/cancellation effects. `/platform/clients/:id` remains under platform clients-view permission; client status changes require `platform.clients.manage` and are enforced server-side.
- `src/pages/platform/PlatformUsers.jsx`: role-based platform user register, pending invitations, invite/resend/cancel, edit role/status and remove access with confirmation. Owner-only grants and last-owner protection remain enforced by PHP. No invite token or URL is fabricated.
- `src/pages/platform/platformModel.js`, `PlatformAdmin.module.css`, `src/utils/platformPermissions.js`: backend-shaped parsers, validation, role checks, currency/date formatting and token-based layouts consistent with workspace administration.

### Updated
- `src/app/routes.jsx`: activate the dashboard, clients list/detail and platform users within the existing authenticated platform shell; add per-route platform capability checks without a subscription-plan restriction.
- `src/app/guards/index.jsx`, `src/app/layouts/AppShell.jsx`: limit the new platform destinations and other platform menu items to capabilities present in `platform_access.permissions` (legacy `platform_admin` accounts keep previous access). Server authorization remains authoritative. Mobile platform tabs respect the filtered menu.
- `docs/BUILD-GUIDE.md`, `design/README.md`: updated platform build order, API caveats and QA gate. Apache CSP and all PHP files remain unchanged.

### Known backend issues and QA
- `GET /platform/clients`: the PHP route forwards `search`, `status` and `subscription_status` but **not `page` or `limit`** to `fetchPlatformClients()`. Although the service supports pagination, the route always returns the first 10 entries. The UI explicitly displays this scope and does not provide nonfunctional page buttons. **Backend change needed:** pass sanitized `page`/`limit` to the service before enabling client paging.
- `GET /platform/client`: operational `approved_invoice_value` and `payment_value` aggregate potentially mixed currencies. The UI intentionally omits those monetary figures; **backend change needed** for reliable by-currency operational totals.
- Local QA still required: `npm install && npm run build`, authenticated role and permission tests (owner/admin/support/billing/viewer), users invitation/changes and last-owner restrictions, client status transitions and session revocation, empty/errors, 390–1440px responsive layouts, light/dark, keyboard/focus, and the built Apache app under the owner-corrected CSP. No claim of production NRS clearance or submission. No new dependencies.

## 2026-11-07 — Redesigned frontend · Phase 2b / batch 13: Platform billing and Premium enquiries

### Added
- `src/pages/platform/PlatformPlans.jsx`, `billingModel.js`, `PlatformBilling.module.css`: platform plan register with search/status/interval filters, genuine PHP pagination, feature/limit entitlement editor, amount/discount preview, Paystack reference, order, and plan activation/deactivation confirmation. Premium contact tiers have no online price or payment mapping. Backend recalculates final prices and entitlements.
- `src/pages/platform/PlatformSubscriptions.jsx`: platform subscriptions register with server-side filters/page sizes, overview KPIs, expiry and webhook diagnostics, and permission-controlled lifecycle sync/reminder sends with confirmation. Sends only via existing backend endpoints; no fabricated billing state.
- `src/pages/platform/PlatformSubscriptionDetails.jsx`: subscription and payment details, available plan options and permission-gated plan changes, expiry extension, cancellation, reactivation, manual verified payment recording, Paystack verification/provider refresh. Status-changing operations are explicitly confirmed, with server-authoritative data reloaded afterward. Manual payments require independent confirmation and do NOT charge a card.
- `src/pages/platform/PlatformPremiumRequests.jsx`: searchable/filterable Premium Requests register, view enquiry details and requested features, update follow-up status and internal notes, preserve existing assigned platform user on edits. A converted enquiry does NOT automatically grant access or represent a paid subscription.

### Updated
- `src/app/routes.jsx`: replaces four placeholders with lazy-loaded pages and adds individual `PlatformPermissionRoute` wrappers for `platform.plans.view`, `platform.subscriptions.view` (list and details), and `platform.premium_requests.view`. Existing platform navigation and platform membership guard stay intact; mutation controls require their `.manage` permission.
- `docs/BUILD-GUIDE.md`, `design/README.md`: new platform billing behavior and QA notes. Earlier changelog entries remain intact. All backend files and existing CSP are unchanged.

### API contracts, limits, and outstanding QA
- The platform Plans, Subscriptions and Premium Requests endpoints support `page` and `limit` and return pagination metadata. Subscription details show at most 30 payment records, and the payment summary is scoped to the **organisation/plan** (it can span multiple subscription records). No complete transaction history is implied.
- **Backend correction needed:** Subscriptions summary MRR adds plan values without grouping by currency, and subscription-detail paid/lifetime monetary summaries can also include mixed currencies. These aggregate figures are deliberately hidden until backend by-currency breakdowns exist; individual records retain their own currency.
- Subscription management accepts actions `change_plan`, `extend_period`, `cancel`, `reactivate`, `record_manual_payment`, `verify_payment`, `refresh_provider`; PHP may reject inferred subscription records and remains the final authority. Manual paid records cannot be reversed from this screen.
- The Premium Requests PUT endpoint resets `assigned_to_user_id` to null if omitted, so the frontend explicitly preserves that ID when updating status/note. Changing assignment is not yet surfaced; it would require active-platform-user selection and the appropriate access. New backend changes are not required for the implemented subset.
- No new dependency or Apache CSP change. Focused syntax/import/contract tests are source-level only. Full `npm run build`, authenticated PHP/Paystack/email integration, visual mobile/dark-mode/keyboard checks, and built Apache CSP tests still require local execution. The app does not claim NRS certification or live submissions.

## 2026-11-07 — Redesigned frontend · Phase 2b / batch 14: Platform Revenue and Activity

### Added
- `src/pages/platform/PlatformRevenue.jsx`: functional `/platform/revenue` with server-side search, payment status/plan/date filters, pagination, subscription payment details with **individual recorded currencies**, count-only platform-wide and filtered metrics, and accessible six-month/plan transaction count breakdowns. The backend's mixed-currency revenue/MRR aggregate is intentionally **not shown**.
- `src/pages/platform/PlatformActivity.jsx`: functional `/platform/activity` with search, event group, recent actor/client, date filters, pagination, actor/organisation details, and globally scoped event metrics. No raw event metadata is rendered.
- `src/pages/platform/platformInsightsModel.js`: UI-free URL filter, strict date validation, response-shape checks, supported backend statuses/groups and recent-selector helpers.
- `src/pages/platform/PlatformInsights.module.css`: token-based transaction bars and event/record details, responsive in light and dark mode; reuses `PlatformAdmin.module.css` register layout.

### Updated
- `src/app/routes.jsx`: replaced Revenue/Activity placeholders with lazy-loaded screens guarded by `PlatformPermissionRoute` (`platform.revenue.view`, `platform.activity.view`). Existing shell menu links and all other guards remain unchanged.
- `docs/BUILD-GUIDE.md` and `design/README.md`: implementation notes, contract risks and manual QA gate. No backend service, dependency or Apache `.htaccess` change.

### Accuracy and verification notes
- The backend reports `summary`, `status_breakdown`, `plan_breakdown` and `monthly_collections` with monetary values aggregated without their original payment currencies. Displaying these as NGN could be wrong; the new Revenue page shows **counts only** in summaries/breakdowns and formats each payment record using `payment.currency`. Accurate overall and filtered revenue require server-supplied currency-separated totals and trends. The existing platform dashboard and other legacy aggregates should also be revisited when that backend work is scheduled.
- Revenue and activity registers are *server paginated*, not locally truncated. Their global summary cards do not change when a table filter is applied. Activity's selector choices are limited by the backend to 100 actors / 150 clients; they must not be presented as exhaustive options. The activity feed is not an immutable compliance ledger. Both screens remain internal DigitalInvoice operations—not NRS certification or production submission.
- Source checks are distinct from `npm install`, complete Vite/browser testing, authenticated PHP endpoints and Apache-served CSP tests. The user's corrected `script-src 'wasm-unsafe-eval'` and `connect-src data:` must be retained and tested with compiled PDFs in Apache.

## 2026-11-07 — Redesigned frontend · Phase 2b / batch 15: Platform Profile & Settings

### Added
- `src/pages/platform/PlatformProfile.jsx`: full `/platform/profile` with backend-confirmed platform role, identity and provider details, name editing, password creation/change, and the existing shared `MfaSecurityCard`. Password changes revoke sessions; successful MFA setup/disable also sign the user out according to the PHP response, while recovery-code regeneration keeps the session active. One-time recovery codes remain visible until acknowledged by the user. This is a **platform** profile, not the workspace-profile data contract.
- `src/pages/platform/PlatformSettings.jsx`: full `/platform/settings` with contact/identity configuration, billing defaults, Paystack configuration health and compliance environment preferences. PHP `platform.settings.view` is required to read, while `platform.settings.manage` governs changes and saving. Supports migration-required, view-only, error, saving, dirty, discard-confirmation, loading and responsive states. Server-only Paystack secrets are never exposed or editable.
- `src/pages/platform/platformAccountModel.js`: validation and strict response normalization for the two distinct platform contracts, with backend-aligned field lengths, country/currency syntax, setting types and ranges; serializes only allowed platform settings.
- `src/pages/platform/PlatformAccount.module.css`: design-token-based, responsive settings panels and metrics; Profile reuses existing `Profile.module.css` to keep workspace and platform security UX aligned.

### Updated
- `src/app/routes.jsx`: new lazily loaded platform profile/settings screens; settings route protected by `PlatformPermissionRoute permission="platform.settings.view"`. Mandatory MFA, platform membership and existing permission guards remain unchanged. Platform account menu and settings sidebar links already existed; no duplicate navigation entries were added.
- `docs/BUILD-GUIDE.md` and `design/README.md`: updated platform build status, permission/API/deployment rules and local verification checklist. Owner-corrected Apache CSP and PHP backend remain unchanged.

### Notes and testing
- Settings are persisted by `GET/PUT /platform/settings`, payload `{settings: {...}}`, only when the `platform_settings` migration has been applied. The UI accurately disables saving when `settings_table_ready=false` and identifies the required migration. Profile identity uses `GET/PUT /platform/profile`, and password uses `PUT /user/password`; shared MFA endpoints remain unchanged.
- `paystack_mode` and `compliance_environment` are **saved preferences**, not proof of live Paystack operation, NRS certification, licensing or actual production submission. There is still no live NRS integration. The dedicated platform FIRS/NRS sandbox integration remains for the next batch.
- Confirm `npm install && npm run build` locally; test platform owner/admin/viewer permissions, profile name/password, Google-only password creation, forced MFA enrolment, recovery-code download/acknowledgment, settings form validation, dirty-state reset, migration missing, both themes, mobile, keyboard/focus, and production Apache `Content-Security-Policy` including react-pdf WASM/data URL use. Source checks alone are not browser/API integration verification.

## 2026-11-07 — Phase 2b / Batch 16: NRS integration controls and modal Select fix

### Added
- `src/pages/platform/PlatformFirsIntegration.jsx` and `.module.css`: new redesigned, permission-aware NRS/MBS platform integration page. Displays internally recorded integration status, sandbox readiness, encrypted-key presence indicators, local UBL preparation counts, the local resource catalogues and ten recent diagnostic records. Credential inputs remain blank on load and are submitted **only when replaced**; previously saved secrets are not returned to the browser. The read-only sandbox currencies-endpoint connectivity check is available only when saved configuration passes the backend's sandbox-readiness conditions. A successful check is not invoice submission or clearance.
- `src/pages/platform/platformFirsModel.js`: strict response parsing, diff-only settings payloads that exclude locked production/Pay-Now flags, validation, and resource text parsing (including inactive flags and duplicate-code protection).

### Updated
- `src/app/routes.jsx`: replaced the platform FIRS placeholder with `/platform/firs-integration` behind `PlatformPermissionRoute permission="platform.firs.view"`. The existing platform sidebar entry and manage-only actions remain gated.
- `src/components/forms/Select.module.css` and `Select.jsx`: fixed the shared modal dropdown layering bug. `react-select` options already portal to `document.body` to avoid clipping; the previous `--z-dropdown` level (60) fell below modal backdrops (`--z-modal`, 90). The shared option portal now sits above modals **and** drawers and uses viewport-fixed menu positioning. Removed the drawer-only stacking override so all overlays behave consistently. No individual modal/select needs a patch.
- `docs/BUILD-GUIDE.md` and `design/README.md`: documented the routes, controls, overlay rule and UI/QA requirements.

### Boundaries and verification
- No PHP, auth guard weakening, permission changes, dependencies or deployment CSP modifications. The owner's Apache `.htaccess` (including WASM/data PDF exceptions) is unchanged. Production transport remains unimplemented and the UI does not offer production submission or Pay-Now switches.
- Source/import, response, settings-diff, resource and styling checks are recorded separately; run `npm install && npm run build` locally and test the built app through Apache CSP. Specifically test selects in Team, Payments, Plans and other **modals** as well as drawers, including keyboard and 390px light/dark mobile; test sandbox gating with approved test credentials only. Never paste real NRS keys into chat logs.

## 2026-11-07 — Cross-stack integration review and targeted corrections (paired PHP + frontend)

### Frontend changes
- Restored real server pagination to `/platform/clients` using the existing `Pagination` component, filter resets and URL page/limit settings. `assertClientPagination()` rejects mismatched server page sizes/numbers instead of silently showing repeated first-page results. **Requires the paired PHP pagination correction.**
- Removed misleading cross-currency subscription totals from Platform Dashboard, Clients register and Client Details. Per-payment records retain their original currencies; these backend aggregate fields require future by-currency reporting.
- Added `docs/INTEGRATION-REVIEW-2026-11-07.md` with verified source contracts, release order, outstanding API gaps and the mandatory live QA checklist.

### Paired backend changes (delivered as a separate PHP-only patch)
- Register missing `PUT /platform/client`, restoring protected client activate/suspend/archive operations.
- Forward `page` and `limit` in `GET /platform/clients` to the existing server pagination implementation.
- Allow edit-capable credit/delivery users to read their source invoice via `requireAnyPermission()` while retaining workspace, entitlement and organisation scoping. View-only users are not given create/edit rights.
- Attach **only database-verified production** document evidence to the public customer portal for invoices, credit notes and payment receipts, after secure-link validation. Proformas and delivery notes remain outside NRS evidence.
- Added offline route/guard contract assertions, separate from DB/browser tests. No database migrations or production NRS submission changes.

### Checks and deployment
- Source API router audit: 165 distinct literal frontend method/path pairs, all registered after the missing PUT fix.
- PHP syntax and eight pre-existing offline test scripts pass; new offline contract tests pass. JSX and import checks and focused pagination tests pass; complete Vite, browser, authenticated API and Apache/CSP checks require local verification.
- **Deploy the PHP patch before the frontend patch.** The user's corrected `.htaccess` was not modified; keep `script-src 'wasm-unsafe-eval'` and `connect-src data:` for PDF downloads on Apache. Full pending issues and QA are recorded in the integration review.


## 2026-11-07 — Step 6: ERP Integration Management UI (frontend only)

### Added
- `src/services/erpIntegrationService.js`: session/CSRF-protected ERP OAuth client, webhook and delivery-history management calls.
- `src/pages/integrations/ErpIntegrations.jsx`, `.module.css`, and `erpIntegrationModel.js`: responsive three-section management page for scoped read-only OAuth clients, HTTPS webhook endpoints and the latest 100 deliveries. Supports create/edit, confirm revoke/disable/rotate, one-time client and signing secret copy/download, explicit credential acknowledgement, loading/error/empty states and strict API response validation.
- `OrganizationAdminRoute`: workspace owner/admin-only route guard, matching the Step 5 PHP role policy.

### Updated
- `src/app/routes.jsx`: `/app/settings/integrations` under active-subscription and operational-workspace guards.
- `src/config/navigation.js` and `src/app/layouts/AppShell.jsx`: Administration → ERP Integrations menu entry with owner/admin role and existing permission/plan visibility checks.
- `docs/BUILD-GUIDE.md` and `design/README.md`: new component, security and regression QA notes.

### Boundaries
- No PHP changes, database migrations, OAuth write operations, production NRS submission, Pay-Now or .htaccess changes in Step 6. Step 5 backend and migration are prerequisites; server integration feature flags default disabled. Validate the full Vite build, browser UX, HTTPS endpoints and webhook delivery locally before enabling integration flags.

## 2026-11-07 — Step 7 integration QA reference (no frontend code changes)

- Backend-only ERP security corrections and a staging test kit were prepared; no workspace screen, route, menu, styles, dependencies or CSP rules changed in the frontend.
- The new backend checklist is `api/docs/ERP-INTEGRATION-STEP7-TESTING.md`. Run the existing `/app/settings/integrations` owner/admin UI checks against a real staging API, including one-time secrets, scopes, webhook edits, light/dark/mobile and permission denial. The authoring environment did not run a full Vite build or browser/API E2E tests.

## 2026-11-07 — Step 8: Platform revenue by currency and invoice snapshot handoff

### Updated
- `src/pages/platform/PlatformDashboard.jsx`: displays per-currency lifetime, current-month and recurring revenue using the new backend `currency_breakdown` contract, without adding unlike currencies.
- `src/pages/platform/PlatformRevenue.jsx`: displays platform-wide monetary totals separately by recorded currency, plus independent filtered paid totals across all matching records. Keeps existing count-based trend charts, plan counts, permission-aware links and paginated payment table.
- `src/pages/platform/platformInsightsModel.js`: rejects missing or malformed per-currency responses instead of silently displaying wrong money values. Validates currency code, amount shape and duplicate rows.
- `src/pages/platform/PlatformInsights.module.css`: adds a small subsection divider for the filtered currency totals inside the established register card.
- `docs/BUILD-GUIDE.md`: Step 8 API-first deployment, invoice historical-data rule and browser QA instructions. No new navigation routes, permissions, dependencies or `.htaccess` changes.

### Tests and limitations
- Added standalone `tests/currencyReporting.contract.cjs` covering mixed NGN/USD values, duplicates, invalid amounts, empty datasets and service response requirements.
- This frontend requires the paired Step 8 backend's `currency_breakdown` fields, and the backend requires the new invoice-location migration. Deploy **migration → backend → frontend**.
- All currency totals are internal DigitalInvoice subscription values; no FX conversion, official NRS verification or production submission is implied. Browser, authenticated database, full Vite build and Apache PDF/CSP QA remain for the deployment environment.

## 2026-11-07 — Step 9: Platform billing currency-safe presentation

- `PlatformClients`, `PlatformClientDetails`, `PlatformPlans`, `PlatformSubscriptions` and `PlatformSubscriptionDetails` now display billing and operational amounts **by recorded currency**, rather than imply a cross-currency total or label mixed payments with the plan currency.
- Added shared `PlatformCurrencyBreakdown` using existing design tokens, cards and responsive styling. Added strict `assertCurrencyAmounts()` validation in `platformModel.js`, so incomplete backend responses show a request error instead of silent zero values.
- `tests/platformCurrency.step9.contract.cjs` covers currency/amount validation and source contracts. No new routes, dependencies, permissions or `.htaccess` changes. Deploy the paired backend first; real MariaDB/Apache/browser integration tests remain required.

## 2026-11-07 — Step 10: release QA tooling and staging acceptance checklist

### Added
- `scripts/qaStep10.mjs`: dependency-free, read-only source/built/Apache gate. Checks the real CSP directives (including the react-pdf WASM and data exemptions), built asset references, SPA fallback, theme script caching and optionally public API/CORS response headers. Live probes require explicit HTTPS hosts and do not authenticate or modify records.
- `tests/qaStep10.test.mjs`: regression tests for valid/stale/unsafe CSP and strict CLI options.
- `docs/QA-STEP10.md`: detailed staging manual test matrix for auth/MFA, invoices, NRS, ERP, payments, reports, permissions, PDFs, overlays, browser accessibility and deployment blockers.

### Known release blocker, not changed by this patch
- The frontend snapshot available during this review contains the **old** `public/.htaccess` lacking `script-src 'wasm-unsafe-eval'` and `connect-src data:`. The owner already applied these corrections locally. We deliberately did not overwrite their corrected `.htaccess`; the new gate therefore fails with the archived file and accepts an explicit `--csp-file` override only for the source scan. The built `dist/.htaccess` is always checked independently.
- `npm ci --offline` could not install `zustand`; no Vite build, real Apache PDF, authenticated browser, live MariaDB, Paystack or ERP/NRS external integration tests are claimed as completed.

### Unchanged
- No production code, CSS design, routes, permissions, database migrations, dependencies, credentials, ERP/NRS feature flags or Apache policy were changed. Both integrations remain subject to the previously documented staging and authorization gates.

## 2026-11-07 — UX corrections / Batch 1: navigation, route feedback and sidebar

### Changed
- `src/app/layouts/AppShell.jsx` and `.module.css`: reorganized Sales/Reports submenus so they **start closed** and only open when the user toggles them; removed the previous grid-row reveal, which could hide lower submenu items. Collapsed navigation opens the requested group when expanded. The desktop sidebar now occupies the viewport edge-to-edge, with full-height navigation and improved interior spacing; the mobile drawer also has square edges. Existing gradients, branding, theme tokens and access guards remain in place.
- `src/utils/navigationVisibility.js`: role/permission filtering stays strict, but permitted Sales destinations are no longer hidden solely because their plan does not include the feature. Such links show a lock/upgrade indicator; the existing `PermissionRoute` still displays the subscription upgrade prompt. No route is exposed to a user without its required permission.
- `src/components/navigation/RouteExperience.jsx` and `.module.css`: global scroll-to-top on pathname changes (without resetting same-page filters or hash changes), immediate accessible progress on internal link navigation, and support for browser Back/Forward. `src/App.jsx` mounts this globally. `AppShell` uses an inline Suspense page loader when lazy modules take time to resolve, preserving sidebar/header instead of appearing stuck.
- `src/pages/system/NotFound.jsx`: clearer route-specific 404, with a safe return destination for authenticated and guest users. The catch-all `path="*"` already existed and remains registered.
- `tests/navigationExperience.batch1.test.mjs`: source/navigation regression checks for seven Sales entries, permission versus entitlement behavior, submenu defaults, scrolling, lazy-route fallback, full-height sidebar and wildcard 404.

### Boundaries and verification
- **Not included in Batch 1:** Service item optional-field review, seed units of measure, and organisation-managed unit creation. Those are Batch 2, which needs the PHP backend/schema as well as frontend changes. The supplied `digitalinvoice.zip` is frontend-only; no API/SQL files were present.
- No application backend, NRS/ERP feature flags, authentication permissions, packages or Apache `.htaccess` were changed. Preserve the owner's locally fixed PDF CSP (`'wasm-unsafe-eval'`, `connect-src data:`) during deployment.
- Source-level regression and syntax checks are separate from real browser/API testing. Validate built app through Apache, both themes, desktop/collapsed/mobile sidebar, permitted versus unentitled versus forbidden links, back/forward scroll restoration, deep-link 404, and slow-network route loading.


## 2026-11-07 — UX Batch 2: catalogue optionality and organisation-owned units

- `ItemFormDrawer`: services may omit a unit and a default price; a blank service unit resolves to the server-owned generic Service unit and a blank service price is stored as 0.00 (variable-price starting point). Products still require an explicit unit and default price. Tax treatment may be blank for either type and uses the organisation's current default. Existing optional code, description, classification and FIRS mappings remain optional.
- Added a local inline **Create your own unit** editor (name, optional symbol, product/service availability) alongside the searchable unit picker. New units are selected immediately without changing the page or opening a nested modal. Shared UI tokens, keyboard accessibility, light/dark styles and responsive drawer layout are preserved.
- `referenceService.createUnit` calls `POST /reference/units`; validation is shared with the backend's proposed API contract. Custom units are NOT verified NRS units.
- **Backend requirement:** Apply `20261107_catalogue_units_batch2.sql` first, then the matching backend patch (new `POST /reference/units`, tenant scoping, service fallback and default price logic), then the frontend patch. The latest complete PHP backend was not supplied in the Batch 2 upload; the backend patch was prepared against the latest API snapshot available in the project. Review against your deployed backend before merging.
- Offline validation tests were added; live MariaDB migrations, authenticated browser tests and Apache-hosted production build remain unverified. The local `.htaccess` containing the react-pdf WASM/data allowances was not changed.

## 2026-11-07 — UI/UX Batch 3: unified workspace controls, header and table layout

- Centralized workspace input/select/date values on `--control-h` (42px) and `--field-text-size` (`--text-sm`). `TextField` and `Select` default to the standard `md` size. The auth layout and forced MFA enrolment explicitly retain the larger 50px input controls and `--text-md` values. Compact pagination selects retain their intentionally smaller size.
- Normalized Dashboard and Reports filter rows: period/currency selects and Apply buttons align with DatePicker without margins or a smaller-size override. All shared fields—including those inside modals/drawers and creation forms—inherit the same standard dimensions; dedicated MFA digits and PDF/document layouts are not modified.
- Restructured the app-shell breadcrumb into a small parent trail above the current page title. Light-theme header gradient is much closer to white and its shadow is reduced to the lightest existing token; dark mode continues to use its themed surface values.
- Reworked the global scrollbar styling to use a slim 6px track/thumb with no arrow buttons, consistent with existing drawer/select-specific thin scrollbar styling.
- Reserved sufficient width for `DataTable` action cells and kept action buttons on a single horizontal line in desktop tables, with horizontal scrolling where required. Mobile action groups may wrap. Default text cells truncate with a native `title` tooltip. Tax Rate code, name, description and treatment also truncate with full-value tooltips to protect table width.
- Tax Rates display as two-decimal percentages, such as **7.50%** rather than 7.5000%. Backend precision, edit values, validation rules and persisted data remain unchanged. Other table actions share the improved `DataTable` behavior.
- Added `tests/visualConsistency.batch3.test.mjs` to verify these visual contracts and preserve the auth-sized exception. No routes, permissions, API contracts, database migrations, npm packages or Apache CSP directives changed.

### Local QA still required
Run `npm install && npm run build`; verify the actual built app under Apache CSP. Check Dashboard and Reports filter alignment, Tax Rates table action row and mobile cards, modals/drawers and date pickers, both themes, resized viewport/horizontal overflow, auth inputs, keyboard navigation and visible scrollbars. Source tests do not constitute browser layout verification.

## 2026-11-07 — UI/UX Batch 4: app-wide soft-gradient cards and meaningful icons

- Introduced **`--card-fill`** and **`--card-fill-hover`** in `src/styles/tokens.css`, with independent light (near-white/soft-blue) and dark (quiet slate/navy) gradients. The shared `StatCard` and applicable workspace card, table, report, filter, settings and detail surfaces now consume these theme tokens rather than copying hard-coded gradients into individual screens. Existing accent-colored KPI fills remain tone-aware, but their saturation is softened. Branded navy hero panels, document/PDF paper, field controls, buttons, menus and overlays retain their intentional surface treatments.
- Added a reusable, icon-bearing `SummaryStat` presentation component for previously text-only metric cards on the workspace Dashboard, Team, Tax Rates, Activity Log, platform administration/billing screens, NRS Integration and grouped currency panels. Labels, numeric values, data boundaries, routes, actions and card-grid placement are unchanged. Small, decorative Lucide icons are `aria-hidden`; semantic descriptions remain readable text.
- Added small icons to the existing invoice, credit-note, payment, proforma and delivery-note detail KPIs and to otherwise plain Dashboard/platform panel headings, without moving data or restructuring page layouts. Corrected the summary label selector so it does not disturb NRS readiness/status badges. Removed obsolete page-local KPI styling after consolidation.
- Added `tests/cardGradientConsistency.batch4.test.mjs` covering theme tokens, screen consistency, icon coverage, gradient surfaces and visual-only scope. No API/schema, session/permission, NRS/ERP status, dependencies or Apache CSP changes.
- **Local QA required:** `npm install && npm run build` and actual visual checks for white/dark gradient subtlety, card readability, compact icon alignment, Dashboard/Platform/Reports/Invoice Details, 390px–desktop breakpoints and accessible tooltips. This workspace cannot run the full Vite build (`vite: not found`).

## 2026-11-07 — UI/UX Batch 5: shared register metrics and centered loading card

- Customers, Products & Services, Invoices, Payments, Credit Notes, Proforma Invoices and Delivery Notes now render their existing KPIs through the same `SummaryStat` component used by the other workspace and platform screens. Their counts, tone-specific icons, loading placeholders, routes and responsive grid columns remain unchanged; duplicate accented backgrounds/top stripes were removed instead of patched over. The shared `--card-fill` theme gradients produce the same quiet surface in light and dark mode.
- `PageLoader` now groups the logo spinner, message and progress indicator inside one centered, softly shaded, bordered card for full-screen and inline lazy-route loading. The loading overlay still fills the viewport; its contents remain centered and accessible, and reduced-motion users receive a nonanimated state. Shared gradient tokens preserve both themes.
- Regression checks cover register reuse, mobile grid spacing, icon values, gradient usage, centered loading, reduced motion and earlier menu/form standards.
- No API, router, permissions, data calculations, new dependencies, database code or `public/.htaccess` changed. A full Vite/browser/Apache CSP test remains necessary in the user's environment.

## 2026-11-08 — Fix: users signed out while actively using the app (production)

Two independent causes, both reproduced against the real code and fixed:

1. **PHP/MySQL timezone mismatch (backend).** PHP is pinned to `Africa/Lagos` (UTC+1) but the MySQL connection used the database server's timezone (UTC on many cPanel hosts). Session times were written by PHP, while activity updates used MySQL `NOW()` (an hour behind), so within a minute of activity the session looked 60 minutes idle and the next token refresh failed with `idle_timeout`. Local XAMPP shares one clock, so it never happened locally. **Fix:** `includes/connection.php` sets the MySQL session `time_zone` to PHP's current offset on every connection; `touchRefreshSessionActivity()` now compares times in SQL.
2. **Overlapping refreshes wiped valid cookies (backend + frontend).** Two refreshes presenting the same refresh token (two tabs whose access tokens expire together, or a slow network) ended with the late one returning 401 and **clearing the cookies the winning refresh had just set**. **Fix:** `routes/auth/refresh.php` answers a token rotated within `SESSION_REFRESH_GRACE_SECONDS` (default 60, max 300) with `409 refresh_superseded` and clears nothing (no new session is issued for the old token). `src/services/api.js` serialises refreshes across tabs (Web Locks API), reuses a refresh another tab made within 15 seconds, and treats `refresh_superseded` as success.

**Verified:** timezone repro (database in UTC) now reports the session active; the late refresh now returns 409 with no cookie deletion; tokens revoked by sign-out, or rotated more than 60 seconds earlier, are still rejected; a two-tab browser test (simultaneous expiry, 4 cycles) stays signed in where the original logged a tab out; all backend test suites pass; the frontend builds. `tests/invoice_finance_integrity_unit.php` now recognises the portable (MySQL + MariaDB) migration format.


## 2026-11-13 — Paystack return: CSRF initialization race fix

### Fixed
- `src/services/api.js`: serialize `/auth/csrf` bootstrap across concurrent calls, and wait for a CSRF token before sending protected POST/PUT/PATCH/DELETE requests. This prevents Paystack return requests to `/subscriptions/verify` from being dispatched without the expected CSRF header after a full page redirect. Public/auth requests with `skipCsrf` retain their existing behavior; the backend CSRF requirement stays enforced.
- `src/stores/useAuthStore.js`: complete CSRF initialization before marking restored sessions authenticated and rendering guarded routes, including `/subscription/verify`. A CSRF bootstrap error now keeps the initial restoration from exposing an authenticated page without its token.

### Verification
- `node --check` passed for both changed JavaScript files. An isolated request-interceptor harness passed: concurrent POSTs share one CSRF bootstrap, public authentication remains CSRF-exempt, and a stale CSRF token is refreshed and retried once.
- `npm ci --offline` could not fetch a missing dependency, and a subsequent install attempt timed out, so `npm run build` and `npm run lint` could not be completed. Live PHP/API, Paystack redirect and browser end-to-end checks remain unverified.

## 2026-11-14 — Payments/onboarding brief · Task 1: Paystack verification retry

- `src/pages/subscription/VerifyPayment.jsx`: kept the existing Paystack return card and loader; when verification fails, the user can **Check again** (re-uses the same reference with loading), or **Return to plans**. Backend `error_id` is shown when supplied. Temporary provider errors (HTTP 502) have the friendly provider-unavailable explanation. A success refreshes the session before **Continue setup**.
- `src/pages/subscription/Plans.module.css`: responsive, token-based side-by-side retry/return actions and readable error-ID text. No plan-card, onboarding, route, store, token, or API-service behaviour was changed in Task 1.
- JSX parsing checked; full Vite production build not executed in this environment because the frontend dependencies are not installed.

## 2026-11-14 — Payments/onboarding brief · Task 2: Pause and resume onboarding
- Shared sign-out action in the onboarding and subscription headers, next to the existing theme toggle. Text appears on desktop and icon-only with an accessible label on mobile. Uses the unchanged auth-store sign-out route and success toast.
- The existing `ConfirmDialog` warns before sign-out if the current onboarding form has unsaved changes; form-save operations disable sign-out until the request finishes. Saved server progress is never deleted.
- Business, invoice defaults, compliance and optional bank details report unsaved edits. Nonempty bank draft fields are validated and persisted on “Continue to review”; a blank optional bank step can still be skipped.
- Onboarding reloads the saved profile/settings/compliance/bank-account records and opens the server-provided next required step. Completed items remain marked in the stepper; returning users see a dismissible saved-progress message. Password, Google and MFA sign-ins all use the same secure redirect decision.
- Plan and payment-verification pages now allow sign-out. On reauthentication, an active paid workspace resumes setup or dashboard while a pending/failed subscription returns to plans. Recovering a previously open Paystack checkout URL is reserved for Task 3.
- Added `tests/onboarding_resume.test.mjs`. No NRS or payment flows were changed in this batch.


## 2026-11-14 — Task 3: resumable pending/failed subscription payments

- Plans page displays an active subscription separately from pending Paystack checkouts. Added Check status, Resume, Cancel and Try again controls using existing Alert, Button, ConfirmDialog and StatusBadge components; disabled other checkout buttons during in-flight operations.
- Platform Subscriptions displays Pending and failed payments with re-verification (billing manage permission), using the existing DataTable and tokenized cards.
- Added corresponding API service functions; no new packages, theme tokens or monetary arithmetic.
- Backend migration/API must deploy before this UI; test Paystack sandbox and responsive light/dark modes.

### 2026-11-14 — Subscription payment exception handling polish

- Open each pending plan on its actual saved billing interval, showing Payment pending and Resume payment immediately.
- Remove the duplicate sign-in "Welcome back" toast when the existing onboarding resume banner appears.
- Show a calm extra-payment notice when billing staff are reviewing a late confirmed charge.
- Add platform billing review badges, an audited manual closure flow and refund/credit/dismiss dialogs using existing Modal, ConfirmDialog, Textarea, Button and DataTable components; preview the pro-rata subscription extension before confirmation.
