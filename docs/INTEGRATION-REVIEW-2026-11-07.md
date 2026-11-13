# DigitalInvoice — frontend/backend integration review (7 November 2026)

**Basis:** source at frontend Phase 2b Batch 16 and the provided PHP API. This is a source-contract and offline regression review, **not** an authenticated browser, MariaDB or NRS sandbox verification. Deploy the paired frontend and backend patches together. No live NRS integration, license, clearance, or production submission is being claimed.

## Corrected in the paired integration batch

| Area | Prior issue | Resolution | Test in live environment |
|---|---|---|---|
| Platform client actions | `PUT /platform/client` existed in PHP handler and frontend service but was absent from API router (`index.php`), causing HTTP 404 | Register `PUT /platform/client` to the existing role-checked PHP handler | Platform manager activates/suspends test client; viewer gets 403; confirm session revocation for suspended client |
| Platform clients pagination | PHP route dropped `page` and `limit` query fields while service paginated; frontend deliberately had no paging controls | Forward pagination parameters; restore shared frontend Pagination control, URL page/limit, filter reset, and response page/limit mismatch detection | At least 25 test clients: pages 1–3, sizes 10/20/50, search/status filters and browser back |
| Credit Note edit-only users | Source-invoice read endpoint required `credit_notes.create` even for edits | Permit *either* `credit_notes.create` or `credit_notes.edit` with full product, operational workspace and entitlement enforcement; **view-only does not qualify** | Test create-only, edit-only, read-only; verify cross-organisation invoice remains inaccessible |
| Delivery Note edit-only users | Same issue for `delivery_notes.create` | Same guarded create/edit access, scoped to invoice organisation | Same edit-only and cross-organisation tests |
| Public portal NRS evidence | Portal used raw document payload without NRS evidence, unlike authenticated document endpoints | After validating token and document shareability, attach read-only `nrsDocumentEvidence()` to invoice/credit note/payment receipt. Non-NRS documents unchanged. Only confirmed, complete production evidence can surface an official QR/IRN/CSID | Approved invoice, note, receipt, proforma, delivery note; missing, sandbox, revoked and expired evidence/token cases |
| Platform monetary summaries | Platform dashboard, client details/list displayed some currency-agnostic aggregates as NGN | Hide those aggregate amounts until backend supplies by-currency totals; individual payment amounts retain actual currencies | USD/NGN mixed subscription fixtures, dashboard, clients and revenue |

## Automated checks available

- All static frontend API method/path pairs compared with `api/index.php`; **no unmatched calls** after registering client PUT.
- PHP syntax checks on changed backend modules.
- Existing eight offline PHP test scripts and new `tests/integration_contracts_unit.php` run without external network or DB (new contract checks are source assertions, not integration tests).
- JavaScript and JSX parsing/import resolution performed via the available TypeScript parser; focused client pagination helper checks.
- Existing modal Select portal CSS and the frontend Apache CSP file were **not changed** in this batch.

## Remaining backend work (not silently implemented)

1. **By-currency revenue summaries**, MRR, plan/payment breakdowns and historical client operational money aggregates. Until then aggregate amounts remain hidden in affected frontend pages.
2. **Buyer address snapshots** for older invoices: the NRS UBL adapter may still read current customer state/LGA/postal data. Snapshot the values during approval before production submission.
3. **ERP integration Step 5**: OAuth 2.0 service clients, scoped APIs and webhooks; design, threats, auth/sandbox constraints and implementation must be reviewed as its own backend phase.
4. **NRS production readiness**: authorization/onboarding, real sandbox response verification, credential handling, audited confirmation and production switch review. Production submission stays disabled.

## Manual release/QA gate

1. Back up the frontend, PHP files, and database; deploy the **API patch first**, then the frontend patch. This batch needs no new database migration, but NRS Step 4's evidence table migration must already exist for public portal evidence.
2. Run `npm install && npm run build` locally. Serve the compiled `dist/` through **Apache with the user's corrected `.htaccess`**. The Vite dev server does not enforce that CSP.
3. Preserve these two CSP allowances for `react-pdf`: `script-src 'wasm-unsafe-eval'` and `connect-src data:`. The attached frontend patch intentionally does **not** contain `.htaccess`.
4. Test multi-select and async selects in short/tall modals and drawers, 390px mobile, light/dark, keyboard, mouse and touchscreen, and the backdrop/focus/scroll behavior.
5. Run a role/entitlement matrix for owner, admin, accountant, invoice officer, approver, viewer and platform roles; test direct route access and 403 handling. Test login/MFA setup, session expiry, password/MFA revocation, PDF export and customer portal evidence.
6. Validate plans and payment flows, local UBL readiness, NRS dry-run queue and per-document evidence. **Never** use synthetic 'verified' production evidence as proof of live clearance.
7. Real API, Paystack, email delivery, Apache PDF, database and browser/e2e tests are **not verified** by this source review.

**Environment caution:** The frontend's *provided* baseline `.htaccess` does not contain the user's locally applied WASM/data CSP additions. Do not overwrite their deployed file when applying the frontend changed-files ZIP. Merge/commit the corrected CSP in the canonical repository separately after confirming the exact production host.
