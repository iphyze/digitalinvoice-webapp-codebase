# DigitalInvoice frontend: build guide

How the redesigned DigitalInvoice app is built, so any developer or AI assistant can continue it. **Read this and `AGENTS.md` first.**

---

## 1. Decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | **React 18 + Vite**, React Router 7 | cPanel has no Node.js. A Vite single-page app keeps addresses like `/app/invoices/123` and `/portal/TOKEN` with one `.htaccess` rule. (Next.js static export was evaluated and works only with a placeholder-page workaround.) |
| Data | Existing PHP API, unchanged | `src/services/api.js`: axios, session cookie (`withCredentials`), CSRF token, automatic session refresh. |
| State | Zustand stores (carried over) | `useAuthStore`, `useAppStore`, `useToastStore`; `useThemeStore` is new. |
| Forms | React Hook Form + Yup | Already in the project. |
| Icons | **lucide-react only** | Font Awesome removed. |
| Motion | CSS transitions/animations + View Transitions API | framer-motion and AOS removed. |
| Selects / dates | **react-select**, **react-datepicker** | Wrapped once as `Select` and `DatePicker` (section 5). |

**Scope:** a **complete UI/UX redesign**, not a restyle. The old app is a reference for behaviour, wording and API usage only; never copy its markup, CSS, class names, layouts or component code. Every feature, label, message and route stays the same; how it looks and feels is new.

---

## 2. Project structure

```
index.html                 favicons, manifest, theme script (no flash), fonts load via CSS
public/
  .htaccess                SPA fallback, caching, security headers (cPanel)
  favicon.svg/.ico, apple-touch-icon.png, icon-*.png, site.webmanifest
src/
  main.jsx                 entry: fonts.css, tokens.css, global.css, BrowserRouter
  App.jsx                  theme + auth initialisation, Suspense, Toaster
  app/
    routes.jsx             THE route tree (addresses, guards, permissions)
    guards/index.jsx       AuthenticatedRoute, PublicRoute, OperationalRoute,
                           SubscriptionActiveRoute, PlatformRoute, PermissionRoute
    layouts/index.jsx      AuthLayout, AppShell, PlatformShell
  pages/                   one folder per area (auth/, invoices/, …); system/ has placeholders
  components/
    brand/Logo.jsx
    ui/                    Button, Spinner, ThemeToggle, PageLoader, Toaster, UpgradePrompt, …
    forms/ data/ overlays/ (to come: see section 5)
  styles/                  fonts.css, tokens.css, global.css
  assets/brand/            DigitalInvoice SVG logos (full/compact × light/dark, icon)
  assets/fonts/            Inter + Sora variable woff2 (+ OFL licences)
  services/ stores/ utils/ hooks/ config/   CARRIED OVER from the previous app
docs/BUILD-GUIDE.md        this file
design/                    approved design board + notes
```

### Carried over unchanged (don't redesign these)
`src/services/*` (21 API modules), `src/utils/*` (formatters, permissions, entitlements, validation, payload builders, invoice calculation preview, report helpers), `src/hooks/useSessionKeepAlive.js`, `src/config/navigation.js`, and the auth/app/toast stores. They depend only on each other plus axios, date-fns, zustand, react and lucide-react. Pages call these exactly as the old pages did.

---

## 3. Design system (Direction B2 · Corporate)

Reference image: `design/direction-B2-corporate.png`. Values: `src/styles/tokens.css`.

### Colour
Use semantic tokens only. Never put raw hex values in components.

| Role | Light | Dark |
|---|---|---|
| Page background `--color-bg` | #F5F7FB | #09131F |
| Card/table `--color-surface` | #FFFFFF | #0F1C2C |
| Text `--color-ink` / muted / subtle | #0A1E45 / #46557A / #5A6987 | #EEF3F9 / #AAB6C8 / #8A98AD |
| Lines `--color-line` / strong | #DCE3EE / #B9C6DA | #1F3145 / #2C4259 |
| Primary `--color-primary` (+ `--color-on-primary`) | #1766C8 (white text) | #5BA4F5 (navy text) |
| Sidebar `--color-side` | #0A1E45 | #0C1724 |
| Success / warning / danger | #0B7F57 / #A65F00 / #C8323C | #42D69C / #F2B45A / #F77A80 |
| Auth form side `--color-auth-canvas` | #FFFFFF (white, so tinted fields stand out) | #09131F (same as page background) |
| Hover `--color-hover` (rows, menu items, options) | #EEF2F8 | #1A2B40 |
| Navy panels `--color-band` (auth brand panel, portal summary, Premium card) | #0A1E45 | #10223A |

Each status has a `-soft` background token for badges and alerts. `--color-accent` (DigitalInvoice green) is for highlights and charts, never for small text. All pairs pass WCAG AA.

**Dark mode** is the previous app's calm slate tones blended with the brand navy (saturation ~0.5, like the old app, instead of the first B2 dark's ~0.7). Use `--color-hover` for every hover/highlight background (never `--color-surface-sunken`, which reads as a black block in dark mode), and `--color-band` for navy panels instead of hard-coded navy.

- **Fields need a white (or near-white) surface behind them** in light mode: their fill (`--color-field-bg`, #F3F7FA) is almost identical to the page background (#F5F7FB). Inside the app they sit on white cards; the auth layout uses `--color-auth-canvas` (white).
- **Select menus:** the menu text size is set on the menu (`font-size: var(--text-sm)`, same as the field's value text), because react-select's own option style sets `font-size: inherit`. The option list has a slim 6px scrollbar without arrows: the page's inherited `scrollbar-color` makes Chromium draw its wide standard scrollbar, so `.menuList` resets it and uses `::-webkit-scrollbar` (Firefox gets `scrollbar-width: thin`). Reuse this pattern for any other scrolling popover.

### Font scale (one place to tune text size)
- `--font-scale` (tokens.css, **0.95**) scales all text app-wide; `--button-font-scale` (**0.90**) scales buttons twice as much; `--button-min-font` (**10.5px**) keeps button text legible.
- The `--text-*` tokens already include `--font-scale`. Any other size must be written as `calc(12px * var(--font-scale))` (or for button rules `max(var(--button-min-font), calc(12px * var(--button-font-scale)))`). Don't add raw px/rem font sizes.
- `global.css` gives every `<button>` the button scale; in component CSS don't reset button text with `font: inherit` (it undoes the scale): use `font-family: inherit` instead.
- Documents (`DocumentSheet`, PDFs) keep fixed sizes, since they mirror printed paper.

### Type
- **Sora everywhere**: headings, body, labels, form fields, buttons, tables (`--font-sans` and `--font-display` are both Sora). This matches the reference app; confirmed by pixel comparison (Sora 0.78 overlap on body text vs ≤0.40 for Inter and others).
- **₦ and dot-below letters (Ọ ọ Ẹ ẹ Ṣ ṣ)**: Sora lacks them. `fonts.css` declares a second `'Sora'` face pointing at `Inter-Fallback.woff2` (only the ~590 characters Sora lacks, 69 KB) with a `unicode-range`, so the browser borrows just those characters and downloads the file only when they appear.
- **Critical rule:** both `'Sora'` faces must have **identical descriptors** (`font-weight: 100 800; font-style: normal`). When the fallback face said `100 900`, browsers treated it as a separate font, never loaded Sora, and the whole app silently rendered in Inter (this was the original cause of the font looking wrong). Verify with DevTools → Computed → Rendered Fonts (should say Sora).
- Amounts, IDs and dates use the `num` class: tabular figures, and they never split mid-number. Document references/codes also get `ref` (stay on one line).
- **PDFs use Inter only** (`components/documents/pdf.jsx`, `fontFamily: 'Inter'`): a neutral, professional face for printed documents that already contains ₦ and the dot-below letters. The app itself uses Sora. The PDF TTFs in `assets/fonts/pdf/` (Inter-Regular/SemiBold/Bold) each carry their own internal name; fonts generated from a variable font keep one name otherwise, and react-pdf then renders every weight the same. Set `fontWeight` explicitly on bold text (business name, document number).
- Sora is ~15% wider than Inter: give dense tables a `minWidth` on `DataTable` (they scroll sideways instead of squeezing), and avoid `overflow-wrap: anywhere` (it splits amounts and names mid-word; use `break-word`).

### Shape, space, motion
- Radius: controls 8px (`--radius-control`), cards 10px, large panels 14px, pills for badges.
- Control heights (taller, more comfortable fields): 34px (sm), 42px (default), 50px (lg: auth forms, mobile).
- Spacing: 4px scale (`--space-1` … `--space-12`).
- Motion: 140–420ms, `--ease-out`; transform/opacity only; everything respects `prefers-reduced-motion`.
- Layers: `--z-dropdown` < `--z-overlay` < `--z-modal` < `--z-toast`.

### Light/dark
- **Light is the default.** Dark is used only when the user chooses it with the toggle; the OS setting is not followed.
- `index.html` applies the saved theme (key `digitalinvoice-theme`, same format as the old app) before first paint, so there's no flash. The browser `theme-color` follows the active theme.
- `useThemeStore.toggleTheme({ x, y })` switches in one frame (`theme-instant` class) with a circular View Transition reveal from the toggle. **Don't add per-element colour fades on theme change**: on the Teecoms site that froze the page for ~900ms and made gradients jump ahead of solid colours.
- Logos swap with CSS classes `on-light-only` / `on-dark-only` (see `Logo.jsx`).
- **Always show the logo with its slogan** (`variant="full"`, ≥32px high; 36–40px in headers and the sidebar). The icon alone is only for the collapsed rail and the loader.

---

## 4. Routing and guards

- `src/app/routes.jsx` owns all addresses and route guards: public pages, guest-only auth pages (`PublicRoute` → `AuthLayout`), signed-in area (`AuthenticatedRoute`), platform (`PlatformRoute` → `PlatformShell`), workspace (`SubscriptionActiveRoute` → `OperationalRoute` → `AppShell` → `PermissionRoute` per module).
- **Mandatory MFA guard (Phase 1a):** `AuthenticatedRoute` redirects authenticated users with `mfaPolicy.enrolment_required` to `/security/mfa` *before* platform/subscription/onboarding/permission guards. `/security/mfa` is authenticated but outside the app/platform shells and is the only permitted route while the policy is enforced. Authenticated users without the enforced policy are redirected away from this route to `nextPath()`. A 403 `mfa_enrollment_required` is handled by the Step 0 API/store interceptor.
- Each not-yet-built screen renders `screen('Title', 'Section')`, a placeholder. **To build a screen:** create it under `src/pages/<area>/`, import it with `lazy(() => import(...))`, and replace the placeholder element. Keep the path and the guards around it.
- Detail and edit pages read IDs with `useParams()`; addresses stay `/app/invoices/:id`, `/app/invoices/:id/edit`, `/portal/:token`.
- `public/.htaccess` sends every non-file address to `index.html`, so deep links and refreshes work on cPanel.

---

## 5. Component library

Built once, used everywhere. Location in brackets; status in the last column.

| Component | Purpose / API essentials | Status |
|---|---|---|
| `Logo` (brand) | `variant` full/compact/icon, `tone` auto/on-dark, `height` | Done |
| `Button` (ui) | `variant` primary/secondary/ghost/danger, `size` sm/md/lg, `loading`, `icon`, `iconRight`, `block`, `to` (Link) / `href` | Done |
| `PageLoader` (ui) | centred on the viewport (fixed, full screen) by default; `inline` centres it in its container. DigitalInvoice icon in a white disc, rotating green-to-blue ring, soft halo, sliding progress bar, `message` | Done |
| `Spinner`, `ThemeToggle`, `Toaster`, `UpgradePrompt` (ui) | Toaster renders `useToastStore`; UpgradePrompt keeps the old copy | Done |
| `TextField` (forms) | `label`, `icon`, `action` (label-row link), `trailing`, `hint`, `error` (sets `aria-invalid`, animates in), `size` md/lg; forwards refs (RHF `register`) | Done |
| `PasswordField` (forms) | TextField + show/hide toggle with a smooth icon swap | Done |
| `GoogleSignInButton` (forms) | carried-over GIS logic (`/auth/config`, popup). Google renders the button in its own iframe, so only Google's themes are possible; `outline` (white) is used in both themes because `filled_black` clashes with the navy dark mode | Done |
| `Alert` (ui) | `tone` info/success/warning/danger/session, `title`, `onDismiss` | Done |
| `PasswordStrength` (forms) | Four checks from `getPasswordChecks`; requirement meter and accessible captions | **Done** (Register) |
| `MfaCodeInput` (security) | Controlled six-digit TOTP: `digits` (array), `onChange(array)`, `disabled`, `error`; keyboard arrows/backspace, six-character paste and autofill; reusable for sign-in MFA | **Done** (Phase 1a) |
| `MfaSignInChallenge` (security) | Reusable password/Google/Google-registration MFA challenge; controlled six-digit `MfaCodeInput` or one-time recovery code; `challengeToken`, `expiresInSeconds`, `onVerified`, `onRestart`; five-minute expiry, five-attempt limit and accessible feedback. Secrets remain in component memory only | **Done** (Phase 1b) |
| `NrsIssuerFields` (nrs) | Five optional NRS issuer fields shared by the existing onboarding compliance form and workspace Organisation Settings; use TextField, preserve supplied values, keep NRS IDs distinct from approved/verified evidence | **Done** (Phase 2a / batch 5) |
| `MfaEnrollment` (pages/security) | Focused full-page route, QR from `qrcode.react`, copyable manual key, expiry, password creation for Google-only accounts, recovery-code copy/download/acknowledgement | **Done** (Phase 1a) |
| `Textarea` (forms) | same API and look as TextField; `rows` | **Done** (Request demo) |
| `PublicHeader` (public) | header for public pages (Landing, Request demo), moved out of Landing; marks the active page | **Done** |
| `Modal` (overlays) | portal to body; focus moves in and is trapped; Esc/backdrop close (not while `busy`); scroll lock; focus returns to the opener; `eyebrow`, `title`, `description`, `footer`, `size` sm/md/lg; bottom sheet under 480px. Put `data-autofocus` on the element that should get focus first | **Done** (Plans) |
| `ConfirmDialog` (overlays) | Modal-based confirmation: `title`, `message`, `confirmLabel`, `cancelLabel`, `variant` (danger), `loading`, `onConfirm`, `onClose`; focus starts on Cancel | **Done** (Plans) |
| `StatusBadge` (ui) | status pill with dot; tone mapping carried over from the old app (active/paid → success, pending… → warning, failed/expired/void… → danger); `label`, `tone` overrides | **Done** (Plans) |
| `Skeleton` (ui) | shimmering placeholder (`width`, `height`, `radius`) using `fx-shimmer` | **Done** (Plans) |
| `Switch` (forms) | on/off tile: `role="switch"` button + label + description; `checked`, `onChange(boolean)`, `disabled`; knob slides (transform) | **Done** (Onboarding) |
| `Checkbox` (forms) | native checkbox with custom box and animated tick; `label`, `description`, `card` (bordered tile), `error` | **Done** (Onboarding) |
| `StatusPage` (pages/system) | full-page status card (not found, access restricted): `icon`, `code`, `title`, `message`, `action { label, to }`, `tone`; includes Go back | **Done** |
| `DocumentSheet` (documents) | on-screen document, approved **modern** template (gradient band, white paper in both themes); renders any model from `documentModels.js` | **Done** (Customer portal) |
| `documentModels.js` (documents) | `DOCUMENT_TYPES` (invoice, credit_note, payment_receipt, proforma, delivery_note): data key, title, reference, `build(doc, organization, logo)` → model. Fields/labels/fallbacks carried over from the old templates; `safeFileName` | **Done** |
| `pdf.jsx` (documents) | `renderDocumentPdf(model)` → Blob via @react-pdf/renderer; **import dynamically** (react-pdf is ~490 KB gzipped). Embeds Inter 400/600/700 + Sora 700 TTFs (`assets/fonts/pdf/`) | **Done** |
| `NrsDocumentEvidence` (nrs) | Shared, read-only on-paper NRS status for invoice, credit note and receipt; centered QR, IRN/CSID **only** when `hasProductionNrsEvidence` passes, otherwise neutral notice | **Done** (Phase 2a / batch 4) |
| `NrsPdfEvidence` (nrs) | Same production gate in PDF; converts existing `qrcode.react` SVG geometry to @react-pdf vector paths, no extra encoder dependency | **Done** (Phase 2a / batch 4) |
| `NrsUblReadinessPanel` (nrs) | Offline UBL v1.1 checks: zero-state, blocking errors/warnings, local schema result and links to remediation screens; never implies NRS clearance | **Done** (Phase 2b / batch 1) |
| `NrsQueueStatus` (nrs) | Backend server-time 24-hour B2C deadline, newest per-invoice dry-run job, org-wide overdue count, error/retry; explicitly not submission evidence | **Done** (Phase 2b / batch 1) |
| `InvoicePaymentDialog` (pages/invoices) | Invoice-scoped payment receipt form, partial amount validation, bank account and method; uses existing `payments.record` | **Done** (Phase 2b / batch 1) |
| `InvoiceSecureLinkDialog` (pages/invoices) | Reusable invoice/credit-note customer portal link issue/copy/list/revoke with `documentType`, separate permission and one-time exposed URL; legacy `invoice` prop still supported | **Done** (Phase 2b / batches 1–2) |
| `CreditNoteDetails` (pages/creditNotes) | Detail page for approved/draft/returned credit notes with source invoice balance, lines, workflow/history, email delivery, preview/PDF/print and offline NRS validation | **Done** (Phase 2b / batch 2) |
| `CreditNotes` (pages/creditNotes) | Credit-note register with Customers Sample A KPIs, search/status/date filters, pagination, desktop table/mobile cards and guarded draft archiving | **Done** (Phase 2b / batch 3) |
| `CreditNoteEditor` (pages/creditNotes) | Approved-source-invoice search, source-backed remaining credit quantities, category/reason/notes, save draft and optional submit, server-controlled totals; reuses Invoice Editor panels | **Done** (Phase 2b / batch 3) |
| `creditNoteEditorModel.js` (pages/creditNotes) | Pure credit-note API parsing, four-decimal line checks, source-line selection and estimated credit; does not override server pricing | **Done** (Phase 2b / batch 3) |
| `creditNoteDetailsModel.js` (pages/creditNotes) | Status/reason helpers, transient credit-note readiness response parser, email-validation reuse, safe PDF filename | **Done** (Phase 2b / batch 2) |
| `DeliveryNotes` (pages/deliveryNotes) | Search/status/date-filtered delivery note register with responsive table, KPI totals, pagination, edit/archive draft actions | **Done** (Phase 2b / batch 5) |
| `DeliveryNoteEditor` (pages/deliveryNotes) | Search approved invoices, select remaining delivery quantities, validated draft/issue form with sticky quantity summary; no new tax invoice | **Done** (Phase 2b / batch 5) |
| `DeliveryNoteDetails` (pages/deliveryNotes) | Source invoice, quantity summary, history, issued-only print/PDF/email/secure links via existing document model | **Done** (Phase 2b / batch 5) |
| `deliveryNoteModel.js` (pages/deliveryNotes) | Pure delivery note adapters, quantity/date/text/email validation, draft hydration and exact backend payloads | **Done** (Phase 2b / batch 5) |
| `Payments` (pages/payments) | Payment register: backend-supported receipt/reference/customer search, status/method filters, server pagination, five truthful count cards, desktop table/mobile cards; record payment modal | **Source implemented** (Phase 2b / batch 6) |
| `PaymentRecordDialog` (pages/payments) | Search active customers with async Select; enter date/currency/amount/method/optional account/reference/notes; creates unallocated receipt via `payments.record` | **Source implemented** (Phase 2b / batch 6) |
| `PaymentDetails` (pages/payments) | Receipt details, allocation/reversal history, payment void with required reason, shared receipt preview/print/PDF, optional email PDF and secure customer links, history and safe NRS evidence | **Source implemented** (Phase 2b / batch 6) |
| `PaymentAllocateDialog` (pages/payments) | Load approved unsettled invoices for payment customer/currency, up to 100 unique invoice allocations, two-decimal amount validation and backend-controlled settlement | **Source implemented** (Phase 2b / batch 6) |
| `paymentModel.js` (pages/payments) | Pure payment adapters, statuses/methods, integer-minor-unit money and dates, record/allocate/email validators and safe receipt filenames | **Source implemented** (Phase 2b / batch 6) |
| `CustomerPortalLinks` (pages/portalLinks) | Latest-80 scoped link register; status/type/search filters, local pagination, source-document navigation and revoke confirmation; no token reconstruction | **Source implemented** (Phase 2b / batch 7) |
| `portalLinkModel.js` (pages/portalLinks) | Pure list contract checks, server-flag statuses, recent-only counts/filtering and permission-aware source-document links | **Source implemented** (Phase 2b / batch 7) |
| `RadioGroup` (forms) | same API as TextField | With next forms |
| `FormField` (forms) | label + control + hint + error wrapper for custom controls | With Login |
| `MoneyInput` (forms) | ₦ prefix, thousands separators while typing, numeric value out | With invoices |
| `Select` (forms) | react-select with `unstyled` + `classNames` (tokens, both themes). Plain values in/out (`value='11-50 employees'`, `onChange(value)`); `options`, `isMulti`, `isClearable`, `isSearchable`, `loadOptions` (switches to AsyncSelect), `label`, `icon`, `hint`, `error`, `size`. Menu portals to `document.body` (never clipped) and uses `fx-pop`. Without search, react-select focuses a hidden input: in tests click the visible control | **Done** (Request demo) |
| `DatePicker` (forms) | react-datepicker re-themed via `:global` rules in `DatePicker.module.css`. Values are `YYYY-MM-DD` strings (API format), shown as `Sat, 24 Oct 2026`; `min`/`max`, `range` (`[start, end]`), `isClearable`, `label`, `icon`, `hint`, `error`; custom month header, Monday start, Today button; calendar portals to `#datepicker-portal`. **Pass `id` to react-datepicker itself** (it overwrites the trigger's id) | **Done** (Request demo) |
| `DataTable` (data) | `minWidth` (px) makes wide tables scroll sideways instead of squeezing text; Configurable columns, renderers, row actions, selection, loading skeletons, empty states, sticky table header, horizontal scroll, custom mobile card renderer under 640px | **Done — Customers** |
| `FilterBar` (data) | Debounced search (360ms), Select filters, removable chips, reset; Customers owns URL synchronisation using `useSearchParams` | **Done — Customers** |
| `Pagination` (data) | Server pagination; page buttons with ellipsis, page size selector, "Showing 1–10 of 248" | **Done — Customers** |
| `Breadcrumbs` (navigation) | built from route metadata; last item is the current page | With app shell |
| `PageHeader` (layout) | title (Sora), description, breadcrumbs, primary/secondary actions | With app shell |
| `StatusBadge` (data) | maps API statuses (draft, pending approval, approved, returned for correction, void, paid, partially paid, overdue…) to tones | With first list page |
| `Reports` (pages/reports) | Report hub with six routes, responsive destination cards, existing reports permission and entitlement | **Source implemented** (Phase 2b / batch 9) |
| `ReportRegister` + `ReportFilters` (pages/reports) | Shared invoices/payments/aging/VAT financial reporting UI: token form controls, server-based totals, page/cap-aware CSV, accessible DataTable, error/empty/retry | **Source implemented** (Phase 2b / batch 9) |
| `CustomerStatement` + `statementPdf` (pages/reports) | Customer running-balance statement, dynamic PDF/XLSX/CSV, permission-gated email with backend validation/attachment limits | **Source implemented** (Phase 2b / batch 9) |
| `ComplianceReadiness` (pages/reports) | Internal-only NRS readiness with account checks, status breakdown and latest-20 awaiting list; no live integration claims | **Source implemented** (Phase 2b / batch 9) |
| `reportModel.js` (pages/reports) | Strict internal report contracts, validated report filters, safe CSV escaping and statement send validation | **Source implemented** (Phase 2b / batch 9) |
| `TeamMembers` + `teamModel.js` (pages/team) | Members and pending invitations, role assignment and status changes with server role restrictions, confirmation, refresh and form validation; `team.view` route, owner/admin write actions only | **Source implemented** (Phase 2b / batch 10) |
| `TaxRates` + `taxRateModel.js` (pages/admin) | Backend-owned standard/zero/exempt/non-taxable treatment, 4-decimal percentages, default & active flags, assignable editing under `tax_rates.manage`; view under `tax_rates.view` | **Source implemented** (Phase 2b / batch 10) |
| `ActivityLog` + `activityModel.js` (pages/admin) | Search/action group/from-to/server pagination and last-30-day organisation metrics; `organization.manage` + `activity_log` entitlement | **Source implemented** (Phase 2b / batch 10) |
| `ErpIntegrations.jsx` + `ErpIntegrations.module.css` (pages/integrations) | Owner/admin-only ERP OAuth clients, webhook endpoints, delivery history; one-time secrets, token revocation warnings, validated scopes and URLs | **Source implemented** (Step 6, browser/API QA pending) |
| `AdminRegister.module.css` (pages/admin) | Shared token-based administration cards, responsive registers and form panels based on Customers Sample A; no legacy styling | **Source implemented** (Phase 2b / batch 10) |
| `Profile` + `profileModel.js` (pages/settings) | Profile identity and connected providers, full-name edit, password create/change with session revocation, MFA security entry point; `/app/profile` | **Source implemented** (Phase 2b / batch 11) |
| `MfaSecurityCard` (components/security) | GET status; setup QR/manual key and six-code confirmation; one-time recovery codes, regenerate with password + code, optional disable with server/role policy checks; shared for future platform Profile | **Source implemented** (Phase 2b / batch 11) |
| `StatCard` (data) | Token-based KPI card, icon, label, value (`num`, Sora), note, tone (blue/teal/amber/red/violet/green), loading skeleton; responsive grid controlled by screen | **Done** (Phase 2b / batch 8) |
| `Modal`, `Drawer`, `ConfirmDialog` (overlays) | Focus trap, Esc close, scroll lock, portal, focus return; `Drawer` supports busy state and footer | **Done** |
| `Tabs`, `DropdownMenu`, `Tooltip`, `EmptyState`, `Skeleton`, `FileUpload`, `Alert` | as named | As needed |

**Rules:** CSS Modules per component; tokens only; every interactive control works by keyboard with a visible focus ring; components accept `className` for layout tweaks, never for colours.

**Heavy libraries load on demand** with dynamic `import()`: `@react-pdf/renderer` / `jspdf` / `html2canvas` (only when generating a PDF), `xlsx` (only when exporting), `@tinymce/tinymce-react` (only on screens with the editor), `recharts` (dashboard/reports chunks). They must never be in the initial bundle (currently 84 KB gzipped).

---

## 6. Documents (invoice, credit note, receipt, proforma, delivery note)

- **One model, two renderers.** `documentModels.js` turns an API document into a model; `DocumentSheet` renders it on screen and `pdf.jsx` renders the same model as a PDF, so they always match. Reuse these on the invoice/credit note/payment/proforma/delivery note detail pages; don't build new templates.
- **Paper is always white**, in both themes (it's what prints and what the PDF looks like).
- **Print:** pages showing a document hide everything else under `@media print` (see `CustomerPortal.module.css`).
- **Narrow screens:** scale the 820px sheet with CSS `zoom` (`useFitScale` in `CustomerPortal.jsx`); measure only once the sheet has rendered.
- **PDF fonts:** the old PDFs used built-in Helvetica, which has no ₦. The new ones embed Inter (has ₦) and Sora for the document number. Keep the GPOS `mark`/`mkmk`/`ccmp` features when subsetting these fonts, or accents like ọ lose their placement.
- **react-pdf limitation:** it ignores the offsets for combining marks, so tone marks without a precomposed character (Yoruba ọ̀, ẹ́) would land after the letter. `pdf.jsx` composes to NFC and drops leftover combining marks for PDFs only ("Adébáyọ̀" → "Adébáyọ"); screens and browser print keep the full spelling.

## Scroll locking (drawers, dialogs, mobile menu)

Always use `lockPageScroll()` from `components/overlays/scrollLock.js`. It sets `overflow: hidden` on `<html>` only. **Never** set `overflow` on `<body>`: that makes `<body>` its own scroll container and breaks every `position: sticky` element (the sidebar jumped up by the scroll distance whenever a drawer opened). `scrollbar-gutter: stable` on `<html>` keeps the scrollbar's space reserved, so locking never shifts the layout.

## 7. Motion

Shared animations live in `src/styles/motion.css`; use the classes instead of new keyframes:

| Class | Use |
|---|---|
| `fx-enter` | pages, cards, panels: fade and lift in (420ms). `--fx-delay` to offset; `--fx-translate-y` and `--fx-from-opacity` can customize the entry without affecting other screens |
| `fx-stagger` | direct children enter one after another, 55ms apart (forms, lists, table rows) |
| `fx-pop` | menus, popovers, Select/DatePicker menus: scale in from `--fx-origin` |
| `fx-shake` | failed submit / invalid action (re-key the element to replay) |
| `fx-shimmer` | loading placeholders |
| `fx-float`, `fx-drift` (keyframes) | decorative loops only (auth brand panel) |

**Auth brand panel** (`AuthLayout`): headline words blur in one after another, then a soft light sweeps across the headline every 7s; the eyebrow's accent line draws in; the description and feature/icon rows slide up once in sequence on initial load (no word blur or repeating lift); product cards float and their chart bars grow in; background light drifts. The form side has a very subtle token-based gradient in light and dark modes.

**Short desktop heights:** The decorative invoice and payment cards remain visible when browser zoom reduces viewport height to 760px or less; the panel adjusts copy spacing and moderately scales the preview instead of hiding it. The regular-height preview is slightly enlarged as well. The panel remains hidden by design below 1024px viewport width.

Note: if Windows "Animation effects" (or macOS "Reduce motion") is off, browsers report reduced motion and the app intentionally shows no animation.

Rules: animate transform/opacity only; 140–420ms with `--ease-out`; decorative loops only on marketing-style surfaces, never inside data screens; everything is disabled by `prefers-reduced-motion`. Auth screens replay their entrance when moving between them (the form area is keyed by path).

## 8. Conventions

- **CSS formatting:** one declaration per line, readable rules (no minified one-line rules). Format with Prettier 3: `npx prettier@3.3.3 --print-width 100 --single-quote --write "src/**/*.module.css"`. Formatting never changes the compiled CSS (verified: all 32 built bundles equivalent before/after).

- **Copy is unchanged** from the previous app. Move strings over exactly; only layout and styling change.
- **Forms:** labels above inputs; errors appear after the user submits, then update live as fields are fixed (`mode: 'onSubmit', reValidateMode: 'onChange'`); error text says what's wrong and how to fix it.
- **Numbers and money:** use the existing helpers in `src/utils/formatters.js`; render with `num`.
- **Toasts:** `useToastStore.getState().showToast(message, type, title)`.
- **Accessibility:** one `h1` per page; icons `aria-hidden`; buttons have text or `aria-label`; colour is never the only signal (badges have text).
- **Performance:** route-level `lazy()` for every page; no animation libraries; avoid layout-triggering animations.

---

## 9. Build and deploy (cPanel)

1. `.env` (copy `.env.example`): `VITE_API_BASE_URL=https://…/api`.
2. `npm install`, then `npm run build`. Output: `dist/`.
3. Upload **everything in `dist/`, including the hidden `.htaccess`**, to the site's document root (cPanel File Manager: enable "Show hidden files").
4. Test a deep link (e.g. `/app/invoices/123`) and a refresh.
5. **Mandatory CSP deployment test:** serve the **built `dist/` output through Apache with its actual `public/.htaccess` copied into the document root**, then inspect the response's `Content-Security-Policy` header and the browser console while testing theme startup, PDF download, Google Sign-In and Paystack. **Vite's development server ignores Apache `.htaccess` CSP**, so a successful Vite run is not CSP verification. Repeat this check after every CSP edit.
6. **PDF exception:** react-pdf uses WebAssembly for layout and loads a `data:` URL module. Preserve `script-src 'wasm-unsafe-eval'` and `connect-src data:` in Apache's CSP; the project owner verified PDF downloads without violations with these allowances. Do not loosen CSP further without a tested need.

**The app runs on `app.digitalinvoice.ng`; the API is on another `digitalinvoice.ng` address.** Browsers treat both as the same *site* (same registrable domain), so the session cookie works with its normal `SameSite=Lax` setting. Because they're different *origins*, the API must allow the app with CORS:

```php
// At the very top of the API's entry point, before any output
$allowedOrigins = ['https://app.digitalinvoice.ng'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);   // never "*" with credentials
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');
    header('Access-Control-Max-Age: 600');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
```

Also:
- The app sends the CSRF token as `Authorization: Bearer …`. On Apache/cPanel, make sure the API's `.htaccess` passes that header to PHP: `RewriteCond %{HTTP:Authorization} ^(.*)` then `RewriteRule .* - [E=HTTP_AUTHORIZATION:%1]`.
- Google Cloud Console → Credentials → the OAuth client used by `/auth/config` → **Authorised JavaScript origins**: add `https://app.digitalinvoice.ng`.
- Frontend `.env`: `VITE_API_BASE_URL=https://<api-host>/api`.

This setup was tested end to end with the app and a mock API on different origins (CORS preflight, credentials, cookie sent after reload, redirects).

---

## 10. Build order and status

| Step | Area | Status |
|---|---|---|
| 0 | Foundation: tokens, fonts, logos, favicons, theme, routing, guards, carried-over logic, `.htaccess`, docs | **Done** |
| 1a | `AuthLayout` (split, Sample A) + **Login**, light default theme, new `PageLoader` | **Done** (see `design/screens/login-*.png`) |
| 1b | Public landing/home page (Concept B — immersive corporate; original links and copy preserved) | **Implemented** |
| 1c | Register (Concept A — seamless split) | **Implemented** |
| 1d | Forgot/Reset password (Concept A — seamless split) | **Implemented** |
| 1e | Check Email + Email Verification (Concept A — seamless confirmation) | **Implemented** |
| 1f | Accept invitation(s): team (`/accept-invitation`, `/team/accept-invitation`) and platform (`/platform/accept-invitation`), Concept A, sharing `Recovery.module.css` + `Invitation.module.css` | **Implemented** |
| 1g | Request demo (Sample A, hero continuation) + Select, DatePicker, Textarea, PublicHeader | **Implemented** |
| 1h | Subscription plans + payment verification (Sample B, navy band), `planUtils.js` (old helpers; fixed the false "Current" match on plans without an id) | **Implemented** |
| 1i | Onboarding (`/onboarding`, Sample B, top stepper): 5 steps in `pages/onboarding/steps/`, shared `StepParts.jsx`; old services, validators, copy and flow | **Implemented** |
| 1j | Customer portal (`/portal/:token`, Sample B) + the document system (`components/documents/`) | **Implemented** |
| 1k | Not found + Unauthorized (`StatusPage`). **Every page outside the shells is now built** | **Implemented** |
| 2 | **Implemented (integration QA pending):** app shell (approved Sample B, inset): floating navy sidebar that collapses to an icon rail with group fly-outs; top bar with breadcrumbs, global search (old shortcut `/`, plus Ctrl K), notifications (`activityService.list({ limit: 6 })`), account menu (sign out); mobile bottom tab bar; nav filtered by permissions + entitlements as in the old Sidebar; shared PlatformShell (old `components/platform/PlatformShell.jsx` used for behaviour only). Customer module built through details (steps 3–4) | **Source implemented; build & API integration QA pending** |

| 2b | UI refinements: calmer dark palette (old app's slate tones + brand navy), `--color-hover` and `--color-band` tokens, taller fields (42/50px), logo with slogan everywhere | **Implemented** |
| 3 | **Implemented (integration QA pending):** Customers list (`/app/customers`), approved **Sample A**: reusable DataTable, FilterBar, Pagination and Drawer; URL query filters, server pagination, responsive cards, add/edit/archive with existing services and validation; CSV export of visible page | **Source implemented; full build / authenticated API QA pending** |
| 4 | **Implemented (integration QA pending):** Customer details (`/app/customers/:id`) with responsive customer summary, compliance, contact, address and notes; skeleton/error states; permission-gated edit/archive/invoice actions; reuses CustomerFormDrawer and ConfirmDialog | **Source implemented; full build / API QA pending** |
| 5 | **Implemented (integration QA pending):** Products & Services catalogue (`/app/catalogue`) and item details (`/app/catalogue/:id`): approved Customers Sample A visual language, shared DataTable/FilterBar/Pagination/Drawer, URL-synced filters, unit pricing and tax details, responsive item cards, add/edit/archive with old item API + validation and reference options | **Source implemented; full build / authenticated API QA pending** |
| 5b | **Implemented (integration QA pending):** Invoice list (`/app/invoices`) using Customers Sample A patterns: five truthful KPIs, search, workflow/FIRS/date filters, URL state, responsive table/cards, server pagination, draft/rejected edit/archive, and original service calls | **Source implemented; full build / API QA pending** |
| 5c | **Source implemented (integration QA pending):** Invoice creation/editing, approved Concept A one-page form, quick-create drawers for customers, catalogue items and payment accounts; original draft/save/calculation API semantics preserved | **Source implemented; complete build/API QA pending** |
| 5d | Invoice Details, Credit Notes, Proforma Invoices and Delivery Notes list/create/edit/details, Payments register/details/record/allocate/void/receipt workflows, and Customer Portal Links Management are source-implemented. Next: Dashboard and reports | **Partially implemented; local QA pending** |
| 5 | Workspace Dashboard implemented (Phase 2b / batch 8); Reports hub and all six report routes source-implemented (Phase 2b / batch 9) | **Dashboard and reports source-implemented; full local QA pending** |
| 6 | Workspace administration: Team Members, Tax Rates and Activity Log (Phase 2b / batch 10); Workspace Profile/MFA security (Phase 2b / batch 11) | **Admin registers and Workspace Profile source-implemented; full local QA pending** |
| 7 | Platform administration: dashboard/clients/users (batch 12), billing (batch 13), revenue/activity (batch 14), Profile & Settings (batch 15); FIRS/NRS sandbox integration remains next | **Platform admin and security source-implemented; sandbox integration pending** |
| 8 | Remaining system screens: not found, unauthorized | |
| 9 | QA: both themes, mobile, keyboard, deep links on cPanel | |

For each step: show design samples (images) for approval, then build.

---

## App shell brief (step 2, implemented; integration QA pending)

Approved design: `design/app-shell-sample-B.png` (Sample B, "Inset"). Build `AppShell` and `PlatformShell` in `src/app/layouts/` (they are pass-throughs today), plus the components below. Reference for behaviour only: old `components/layout/AppShell.jsx`, `Sidebar.jsx`, `Topbar.jsx`, `components/search/GlobalSearchModal.jsx`, `components/platform/PlatformShell.jsx`.

**Layout**
- Floating navy sidebar (rounded, `--color-side`, navy in both themes) with breathing room around it; page content on its own rounded sheet (`--color-bg` sheet on a `--color-surface-sunken` frame).
- Sidebar top: compact logo (`Logo tone="on-dark"`) + collapse button; organisation card (initial avatar, name, green "Active" dot).
- Sections "Workspace" and "Administration" from `src/config/navigation.js` (labels, icons, paths, children). Groups (Sales, Reports) expand in place; the active child gets a green→blue accent bar.
- **Collapsed:** slim icon rail (~72px); hovering/focusing a group opens a fly-out menu with its children. Remember the collapsed state in localStorage.
- **Filter nav items exactly like the old Sidebar:** `hasPermission(permissions, item.permission)` and, when the item has `entitlementKeys`, at least one enabled in `entitlements.features`. Hide groups with no visible children.

**Top bar** (inside the sheet)
- The shared top bar is sticky during page scrolling (`position: sticky`), with a small responsive viewport offset, inset spacing, full four-corner rounding, a token-based outline and a restrained shadow. It stays visible over scrolling content in light and dark themes; the sidebar and mobile bottom navigation retain their own positioning. Avoid ancestor overflow rules that break sticky positioning.
- Breadcrumbs from the route (e.g. Sales › Invoices).
- Global search button ("Search invoices, customers, payments...") opening the search modal; shortcut **`/`** (old behaviour, ignored while typing in a field) plus Ctrl/⌘ K.
- Notifications bell: "Workspace activity" panel, `activityService.list({ limit: 6 })` when opened and the user can view activity; "Latest audit events"; "View activity log" link.
- Theme toggle.
- Account menu: name, email, "Secure account", Profile, "Sign out securely" (`useAuthStore.logout()` then `/login`, same messages as the old Topbar).
- Menus close on outside click and Esc (old behaviour); use `fx-pop`.

**Mobile** (≤ 900px): sidebar hidden; top bar with menu button, compact logo, search icon, avatar; **bottom tab bar** (Dashboard, Sales, Payments, Reports, More). "More" opens a sheet with the remaining items. Respect `env(safe-area-inset-bottom)`.

**Motion:** sidebar width/rail transition (transform/opacity where possible), groups open with height+fade, page content keyed by path with `fx-enter`, menus `fx-pop`. Reduced motion respected.

**PlatformShell:** same design with the platform navigation from the old `PlatformShell.jsx`.

**Implementation:** `src/app/layouts/AppShell.jsx` provides both `AppShell` and `PlatformShell`. The approved inset navy navigation has a saved collapsed state (`digitalinvoice-shell-collapsed` in localStorage), group fly-outs, permission/entitlement-filtered workspace menus, unfiltered platform owner-console destinations, responsive bottom navigation and a More sheet. `src/components/shell/GlobalSearch.jsx` queries the existing search services with a 260 ms debounce; `src/components/shell/PageHeader.jsx` is the reusable page heading. All existing route guards remain in place. Shell placeholders now display neutral skeletons rather than a competing public-page header.

**Verification:** JSX parsed with TypeScript, CSS parsed successfully, local CSS-only Chromium layout previews (not a full React render) were checked at 390/1024/1440 widths with no horizontal overflow. `npm ci` failed because the package registry is unreachable in this environment; **a Vite production build, real authenticated session, live search/notifications and keyboard integration still require testing in a dependency-enabled environment**.

**Done when:** every `/app/*` and `/platform/*` placeholder renders inside the shell, nav filtering matches the old app for a few permission sets, search/notifications/account work against the API, both themes, keyboard, mobile tab bar, no horizontal scroll at 390px.

## 11. QA checklist (every delivery)

1. `npm run build` passes; serve `dist/` with Apache (or upload) and test deep links + refresh.
2. No console errors in light or dark mode.
3. Widths 390 / 768 / 1024 / 1440: no horizontal scroll, nothing overlaps.
4. Keyboard only: everything reachable, focus visible, Esc closes overlays.
5. Reduced motion: nothing animates or loops.
6. Signed-out visits to protected pages redirect to `/login` and return afterwards.

---

## 12. Handover to another chat system

See `docs/HANDOVER.md` for what to share and a ready-to-paste prompt.

## 13. Prompt for one screen (short)

> You're continuing the DigitalInvoice NG frontend (Vite + React SPA, deployed as static files to cPanel; repo attached). Read `AGENTS.md` and `docs/BUILD-GUIDE.md` first; they're the source of truth. Follow the design in `design/direction-B2-corporate.png` using only tokens from `src/styles/tokens.css` and the components in `src/components`. Build **[screen]** in `src/pages/[area]/`, keep its route, guards and permissions in `src/app/routes.jsx`, and call the existing services in `src/services` exactly as the previous app did. Keep all copy unchanged. Run `npm run build`, fix errors, and list the files you added or changed.


### Customer UI refinement (Sample A, October 2026)

- Keep the customer search field proportional to the customer-type/status selects, not flexed across most of the filter row; on narrow screens, search uses its own row.
- Search, react-select and ordinary input controls share the `--control-h` height. Select choices are regular-weight at 13px; compact Customer Drawer inputs/labels and standard buttons use smaller typography while preserving accessible hit areas.
- Customer stats have a restrained, token-based accent gradient per metric (info/success/warning). The customer form Drawer has a soft theme-aware gradient in the header/body/footer.
- The empty-state illustration remains blue, while the **Add customer** button icon inherits white from the primary button in light and dark themes.
- These are presentation-only adjustments: no customer service, validation, permission, navigation, export or URL-sync logic was changed.

### Customers list — Sample A implementation (step 3)

- Route: `src/app/routes.jsx` lazy-loads `src/pages/customers/Customers.jsx` behind the existing `customers.view` permission guard. Actions that modify records additionally check `customers.manage`.
- API: `customerService.list({search,type,status,page,limit})`, `create`, `update` and `archive`, unchanged. Pagination and filter criteria are owned by URL search parameters; the search field applies its change after 360ms. Default status is Active; default limit 10.
- Data: `src/components/data/` contains reusable `DataTable`, `FilterBar`, `Pagination` and CSS modules; `src/components/overlays/Drawer` has focus trap, Esc, backdrop and scroll lock.
- Edit form: fields/payloads use `validateCustomerForm` unchanged. Errors first appear after submission and then revalidate on changes; drawer preserves optional tax, contact and address fields. Archived records cannot be edited.
- Export currently downloads **only the rows shown on the current page** to a formula-safe CSV file named `customers-page-N.csv`. There is no existing bulk export endpoint in `customerService`; full-list export should be treated as a separate API-backed enhancement.
- Visual QA screenshots under `design/screens/customers-*` are static layout previews using representative fictitious data, not connected/authenticated application screenshots. Live API and complete Vite QA remain pending in this environment.


### Customer details — Sample A continuation (step 4)

- Route: `src/app/routes.jsx` lazy-loads `src/pages/customers/CustomerDetails.jsx` at `/app/customers/:id`, under the existing `customers.view` guard.
- Data: uses the existing `customerService.show(id)`, handles loading with accessible skeletons and shows the original unavailable/error copy with a retry action; late responses are ignored on navigation.
- Structure: identity hero and status, contact strip, compliance information, primary contact, billing address and record summary/notes, all using design tokens and responsive cards. Missing values show a dash, not invented data.
- Actions: Edit + Archive require `customers.manage` and cannot be used on archived records. Create Invoice requires `invoices.create` and points to the existing `/app/invoices/new?customer=ID` route. Edit reuses `CustomerFormDrawer`, reloads saved data from the API. Archive uses `ConfirmDialog`, preserves existing warning/toast copy and navigates back to the Customers list.
- QA: desktop light/dark and mobile static preview screenshots under `design/screens/customer-details-*` use illustrative data and are not authenticated/API screenshots. Full build and live API QA require a complete `node_modules` installation plus the backend session.

### Refinements carried into subsequent app screens (October 2026)

- Use the shared `Select` (`react-select`), including in Pagination for the rows-per-page control. Dropdown option text uses 12px regular weight; keep native selects out of newly built filter and pagination UIs.
- Primary and secondary app buttons use the more compact, medium-weight type from `Button.module.css`; preserve accessible keyboard focus and the existing gradient/hover effects.
- The workspace navigation has a fixed navy palette in both themes (using `--shell-nav-*` design tokens). The workspace summary sits beneath the scrollable menu near the bottom of the sidebar, rather than above the navigation; on a collapsed rail it reduces to an icon.
- The main app content frame has no enclosing outline; tables, controls and cards retain their own useful boundaries. The Customers View (eye) action is borderless.
- Secure account and Active indicators use softer, theme-aware success colours, especially on dark surfaces.


### Final Customer/App Shell visual refinements (October 2026)

- The logo and first **Workspace** navigation heading have extra breathing room in the scrollable sidebar; collapsed and mobile navigation maintain proportionate spacing.
- The shared Select component now reserves space between selected-option labels and checkmarks across the application (including in menu portals).
- The inset app content canvas uses a token-derived, theme-aware radial/linear gradient in light and dark. It remains borderless; interactive controls keep their own borders and keyboard focus outlines.
- Customer Details includes restrained token-based gradients and a small accent on the profile hero and four information cards, with coordinated icons/shadows and reduced-motion respect. No customer fetching, validation, permissions, or other business logic changes.


### Latest sidebar and Select refinements

- The workspace sidebar uses the same layered navy/teal background character as the authentication brand panel across light/dark themes; active navigation uses a refined gradient.
- The current-workspace dock shows only the truncated organisation name and an activity-status dot, with a full name/status tooltip.
- `Select` renders the selected checkmark as a separate icon with a fixed gap from its label in every menu, including portals.


## Products & Services catalogue — implementation notes (step 5)

- `src/pages/catalogue/Catalogue.jsx` handles `/app/catalogue` using existing `itemService.list` with `search`, `type`, `status`, `page`, `limit`. The URL preserves filters and pagination; shared FilterBar debounces search 360 ms. Stats: total records, products/services on current page, taxable items on current page.
- Reuses the existing refined data components (`DataTable` desktop with mobile cards, Select, FilterBar, Pagination, accessible Drawer, ConfirmDialog), light/dark tokens and animations. The shared Pagination now accepts `noun="items"` so counts are correctly labelled; Customers still defaults to `customers`.
- `ItemFormDrawer.jsx` keeps `validateItemForm`, the precise item payload and toasts from the old catalogue; it loads units/tax rates through `referenceService`, optional FIRS mapping lists via `firsService.options`, and preserves edit/archive behaviours. No changes to service modules, utils, stores, or guards.
- `ItemDetails.jsx` preserves item details, tax/compliance information, permission-filtered Create Invoice/Edit/Archive actions, loading/unavailable states.
- **QA status:** JSX parsed and CSS syntax checked; complete Vite build and live PHP API smoke tests are still required in a fully installed local frontend. Preview screenshots use representative data, not a live API response.


## Invoice register — implementation notes (step 5b)

- `src/pages/invoices/Invoices.jsx` replaces the invoice list placeholder at `/app/invoices`. Old `pages/invoices/Invoices.jsx` supplies wording, workflow statuses, FIRS readiness filters, API contract, permissions and archive messages; no old markup/styles/motion are reused.
- Existing `invoiceService.list`, `invoiceService.archive`, `readInvoiceCollection`, status formatting and permission helpers are reused unchanged. Server-side page sizes 10/20/50; filters `search`, `status`, `firs_compliance`, `date_from`, `date_to`, `page`, `limit` are reflected in the URL. Search is debounced by the existing `FilterBar` (360ms).
- Five metrics distinguish dataset total from per-page counts; page totals show “Mixed currencies” instead of adding unlike currencies. Responsive table/mobile cards, selected-option behaviour, and pagination reuse the approved shared components. Edit/archive are exposed only for drafts/returned invoices to `invoices.edit` users; New Invoice requires `invoices.create`.
- `/app/invoices/new` and `/app/invoices/:id/edit` now load `InvoiceEditor.jsx` (step 5c), under the pre-existing `invoices.create` and `invoices.edit` guards. `/app/invoices/:id` is now implemented by `InvoiceDetails.jsx` (Phase 2b / batch 1); see the current Phase 2b notes below.
- QA: parsing, import integrity, CSS checks and static responsive layout checks run locally. An authenticated PHP API smoke test and a complete Vite build remain required. Preview screenshots use representative data.


## Invoice creation and editing (step 5c, approved Concept A)

- Routes: `/app/invoices/new`, `/app/invoices/:id/edit` use `src/pages/invoices/InvoiceEditor.jsx` and `InvoiceEditor.module.css`. Do not rewrite the completed register or permission guards. The Invoice Details route is now implemented in Phase 2b / batch 1.
- One-page editing grid with customer/document information, product/service line cards, FIRS/MBS classifications, notes and a sticky server-verification/totals side panel on wide screens. Mobile stacks controls; light/dark styling uses the existing design tokens and shared motion.
- `+` beside Customer reuses **`src/pages/customers/CustomerFormDrawer.jsx`** unchanged. `+` beside each line's Product/Service reuses **`src/pages/catalogue/ItemFormDrawer.jsx`** unchanged. `+` beside Payment account uses `InvoicePaymentAccountDrawer.jsx` with the **same shared `Drawer` + CustomerFormDrawer CSS/form pattern**; there is no competing drawer skin. Closing a drawer keeps the invoice intact; saved records are merged into available options and selected if eligible for the invoice currency. Fixed/reference values such as currency, taxes and FIRS code lists do not offer unverified create actions.
- `invoiceService.calculate`, `invoiceService.create`, `invoiceService.update`, and server re-read via `invoiceService.show` preserve the legacy payload contract. Local subtotals use the **existing** `calculateInvoicePreview`; a server-verified total supersedes the estimate only for the matching current request signature. Incomplete lines are excluded from preview calculations but prevented from saving by validation. Tax rates and currency are loaded from the backend.
- Edit allowed only for draft/returned (`rejected`) records, as in the old form; save does **not** submit for approval or send to a customer. Draft saving navigates to the (currently placeholder) Invoice Details route, matching the previous workflow. FIRS live submission / Pay-Now remains disabled.
- Reference visual `design/screens/invoice-editor-approved-concept-a.png` is the **approved illustrative concept**, NOT a screenshot of the compiled current React screen.
- QA: source parser and module import checks performed; server/API runtime and a full authenticated browser build remain to be checked in the deployment environment.


### October 2026 — header, typography and form-field refinement

- The shared App Shell header is a floating, sticky, borderless, subtly graded surface. Desktop horizontal inset **matches the main content's 20px inset**; tablet and phone insets match content spacing. Four-corner rounding and shadow remain visible while scrolling. Sidebar, navigation and search behaviour have not changed.
- The notifications bell and header theme toggle share **40×40px** desktop boxes (36×36px on small phones). The header passes its style to the reusable ThemeToggle; other theme toggles remain unchanged.
- The original self-hosted **Sora variable font** remains the display/heading font, while Inter remains the main UI, body and field font. Global and shared page headings use more measured weight and spacing to better match the supplied typography reference; external fonts are not introduced.
- Semantic `--color-field-bg`, `--color-field-border` and `--color-field-icon` tokens establish an off-white light form surface and softly contrasting dark form surface. Shared TextField, Textarea, Select, DatePicker, FilterBar search and GlobalSearch read from the same palette; focus, error and accessibility states are preserved.

### Drawer scroll isolation and Sora typography refinement (19 Oct 2026)

- `src/components/overlays/scrollLock.js` now coordinates document-level scroll locking for Drawer and Modal. Both `html` and `body` scrolling are locked while an overlay is open, with scrollbar-width compensation and reference counting for stacked overlays. Drawer content remains independently scrollable; closing the final overlay restores previous document styles.
- Keep the Drawer focus trap and restore focus **without scrolling** when it closes. The overlay's effect should depend on `open`, not changing inline callbacks or `busy` states, so field edits do not repeatedly unlock or refocus the page.
- **Font source remains the existing self-hosted Sora variable WOFF2** in `src/styles/fonts.css`; do not add a duplicate Google Fonts network import. It contains the same Sora family and supports 400/500/600/700/800 (and intermediate variable weights). Inter remains the body/form font; Sora is for display/headings and prominent figures, as specified in the B2 design system.
- Typography hierarchy is deliberately lighter: page titles, drawer titles, section headings, KPI figures, and marketing headlines generally use Sora **600**; minor UI-display text uses **500**; the limited brand monograms retain **700**. Avoid restoring blanket 700–800 headings. Small uppercase form-section headings use Inter 600.
- The scroll-wheel behaviour was verified in a standalone Chromium fixture: background scroll position stays fixed when the wheel is moved over the backdrop, drawer inner scrolling works, stacked locks remain engaged, and scrolling resumes after the last overlay closes. Full authenticated React navigation / Vite build tests still require complete project dependencies.


## NRS Steps 1–4 — frontend logic setup (6 Nov 2026; Step 0)

This section is a migration stage **after** the existing redesign foundation in section 10; it does not undo that foundation or modify existing route permissions. The redesigned frontend is the main application; the older frontend supplies only existing behaviour and API contracts. The PHP backend remains unmodified during the frontend phase.

**Synchronized, UI-free logic** (from the old frontend):

| Module | Responsibility |
|---|---|
| `src/services/authService.js` | MFA challenge verification (`/auth/mfa/verify`) |
| `src/services/mfaService.js` | MFA status, setup, confirmation, disable and recovery-code regeneration |
| `src/services/api.js` | MFA enrolment-required interceptor on HTTP 403 and no-refresh MFA verify |
| `src/stores/useAuthStore.js` | Challenge results on password/Google login, `verifyMfa`, `mfaPolicy` session state, enrolment redirect |
| `src/services/firsService.js` | Classification codes and dry-run submission queue |
| `src/services/creditNoteService.js` | NRS credit-note readiness call |
| `src/services/platformService.js` | Gated sandbox health check |
| `src/utils/appPaths.js` | `/security/mfa` start-path resolution when enrolment is required |
| `src/components/security/mfaCodeUtils.js` | Pure six-digit input helpers (UI to be built later) |
| `src/components/nrs/nrsEvidence.js` | Pure verified-production-only IRN/CSID/QR gating, including verification timestamp |

**CSP:** `public/.htaccess` enforces `frame-ancestors 'none'` and permits the approved API origin, Google Identity Services, Paystack and local PDF blob workers. The formerly inline theme-startup script lives in `public/theme-init.js` as a blocking `<head>` script, without `unsafe-inline` for scripts; the bootstrap is served `no-cache`. **User-verified PDF correction:** the deployed Apache policy also needs `script-src 'wasm-unsafe-eval'` for react-pdf's WebAssembly layout and `connect-src data:` for its `data:` URL module. Test CSP with built output served by Apache as required in section 9, not only Vite. Match API origins in `connect-src`/`img-src` to the deployed `VITE_API_BASE_URL` (candidate production origin `https://api.digitalinvoice.ng`, confirmation pending) and smoke-test Google Sign-In, Paystack, PDFs and printing. `style-src` uses `unsafe-inline` because the app and embedded services use inline styles.

**Planned phases — do not skip the validation gate:**

1. **Phase 1 audit — COMPLETED:** review auth and invitation flows with old UI and PHP routes; screen/endpoint/gap/build table approved before changing auth code.
2. **Phase 1a — IMPLEMENTED, awaiting local validation:** `/security/mfa` screen and guard, handling for 403 `mfa_enrollment_required`, QR/manual setup, Google-only initial-password branch, confirmation, one-time recovery codes and post-confirmation re-login. MFA codes use `MfaCodeInput`; `qrcode.react@^4.2.0` adds the inline SVG QR. The server revokes sessions after both `PUT /user/password` and `POST /user/mfa-confirm`: on password creation clear local auth and return to login immediately, but after MFA confirmation keep recovery codes **in memory only** until the user saves them and confirms receipt, then clear local auth and return to login. Password, setup key and recovery codes must never be saved to localStorage or logs.
3. **Phase 1b — IMPLEMENTED, local validation pending:** a reusable second-factor step for password login, Google sign-in and existing-account Google registration (`POST /auth/mfa/verify`). It shows six separate numeric boxes (`MfaCodeInput`), a switchable one-time recovery-code field, five-minute time remaining, invalid-code feedback and server-enforced five-attempt limit (tracked locally to guide the user). An expired/blocked challenge requires a new sign-in. Only `verifyMfa` applies an authenticated session; never store challenge tokens, recovery codes or passwords in persistent browser storage. Keep the original Google business-name setup for new registrations.
4. **Phase 1c — IMPLEMENTED, local validation pending:** `/verify-email` respects `mfa_sign_in_required` from `POST /auth/verify-email`, clears the stale client session (the backend revokes refresh cookies), displays **Sign in securely**, and never creates an MFA challenge from a verification link. Non-MFA verifications still apply the backend session; if mandatory MFA enrolment is required by `mfa_policy`, offer **Set up secure sign-in** before subscription. Registration remains on the existing screen with backend-aligned full-name (120) and business-name (180) length limits and a safe fallback for malformed development verification URLs; password/Google registration continue to use their original backend endpoints.
5. **Phase 1d — IMPLEMENTED, local validation pending:** team invitation validation and authenticated acceptance, platform invitation MFA-first redirect, authenticated check-email resend and already-verified/guest states, forgot/reset token handling and revocation-aware logout, shared single-flight refresh recovery, activity-aware session keep-alive and permission-safe post-login deep links. Test light/dark/mobile/keyboard/errors against the backend and built Apache-served CSP.
6. **Phase 2a — batches 1–5 IMPLEMENTED (local QA pending):** customer NRS address fields, catalogue classification codes, invoice line snapshots, B2C dry-run queue, evidence-aware documents/PDF/customer portal, and organisation compliance settings. The public portal evidence backend extension still awaits separate approval; see batch 4 notes.
7. **Phase 2b — batches 1–3 IMPLEMENTED (local QA pending):** invoice details, workflow, payment/secure links, document output, UBL preflight and local submission queue; credit-note details, source invoice and adjustment breakdown, transient offline UBL check, and approved-only document delivery. Credit-note listing and new/edit workflows are now included. Continue with later application screens in section 10's build order, carrying inventory features into each.

**Phase 1a deploy gate:** run `npm install` and `npm run build`; test a *built Apache-served* app with enforced CSP, an enforced-MFA account, a Google-only privileged account, wrong password/code, expired key, reload, recovery-code acknowledgement, sign-out, and light/dark/mobile/keyboard flows. The frontend guard is UX; the backend retains authority to enforce the allowlist. The Phase 1b sign-in challenge is now source-implemented but **must pass end-to-end API/browser testing** (password, Google login, Google registration, recovery code, expiry and attempts) before deploying enforced MFA.

**Shared helpers:** `mfaCodeUtils.js` now powers the new `MfaCodeInput` visual component. `nrsEvidence.js` remains a pure business-logic module pending Phase 2 document integration. No auth layouts or old styles were ported.


**Phase 1b MFA sign-in test gate (2026-11-06):** Verify with a backend-enabled MFA user that neither `/auth/login` nor `/auth/google` creates a frontend session when `mfa_required` is returned. `POST /auth/mfa/verify` must be the only event that applies the authenticated payload. Test wrong and valid six-digit codes, full-code paste, one-time recovery codes, fifth failed attempt, five-minute expiry, invalidated challenge, restart, and Google account linking deferred until MFA succeeds. Check light/dark/mobile/keyboard and the built Apache-served CSP. No new dependency, route or permission is introduced in Phase 1b.


**Phase 1c verification gate (2026-11-07):** Run a fresh account through password registration → `/check-email` → verification link → subscription (or mandatory `/security/mfa` when the server explicitly requires it). For a user with MFA already enabled and a valid verification token, `POST /auth/verify-email` must return `mfa_sign_in_required`; the UI must show **Sign in securely**, clear the old client session, and require password/Google sign-in plus `/auth/mfa/verify` before restoring any authenticated session. Test missing/expired/reused tokens, failed email delivery with the resend path, duplicate email, overlong names (120/180 code-point maxima), password mismatch/strength, invalid development verification URLs, and successful Google registration. Check both themes, mobile and keyboard; repeat auth/CSP smoke tests using the built app via Apache with the corrected `.htaccess`. No API, route, guard, CSS, package or CSP changes in Phase 1c.


**Phase 1d auth/invitation and session test gate (2026-11-07):** Both invitation endpoints create a real session. Team and platform invitation acceptance must apply its `authPayload` and go through `resolveAuthenticatedStartPath()`; privileged invitations must not bypass `/security/mfa`. Validate team tokens before rendering a form; test missing, expired, already-used, cancelled and suspended-organisation responses. The check-email resend API is authenticated-only (`POST /auth/resend-verification`), with a 60-second throttle and an already-verified response; guests must be shown a login path rather than an unusable resend button. Reset confirmation invalidates refresh sessions, so clear the client session before navigating to `/login`; development reset/verify URLs must be converted to local app paths, never followed to a new origin. The browser must restore sessions when the access cookie has expired but a valid refresh cookie remains; use one in-flight refresh request to avoid rotating the cookie twice (including React StrictMode). The activity-aware heartbeat is enabled but must **not** poll on `/security/mfa`, where one-time recovery codes could be lost after server-side session revocation. After login/MFA, honor a saved return URL only within the already-authorized workspace or platform scope, and never ahead of MFA, email, subscription, onboarding or per-module route guards. Sign-out must clear local state even when the session has already ended. Do not report these as live tested until checked with the actual PHP API, cookies and built Apache-served CSP. No new dependencies, backend updates or CSP edits are included.


**Phase 2a / batch 1 — Customer and Catalogue NRS port (2026-11-07):**
- Customer add/edit drawers now expose `nrs_postal_zone`, `nrs_state_code` and `nrs_lga_code` in the existing Billing address grid; backend max lengths are 20/100/100. Customer details shows saved values. No new field components, services, routes or permissions.
- Catalogue item drawers use the already-synced `firsService.classificationCodes('goods'|'service')` from `GET /firs/classification-codes`. Render the shared searchable Select when `verified: true` and codes are available. Otherwise allow a manual draft value **clearly marked unverified**. Even when a list is imported, operators may explicitly switch to an unverified manual code. Preserve older manually saved codes on edit; selecting a different item type must clear the old classification, and must refresh the relevant goods/service list. Switching between imported and manual entry clears the code to avoid hidden stale values.
- The classification API's `verified` means its resource-cache record was synced, **not** that DigitalInvoice holds an NRS licence or that a particular document/code is certified. Never equate this with successful NRS submission. The form continues to save to `/items` and documents remain gated by `nrsEvidence.js`.
- UI styling follows the existing Drawer/TextField/Select and tokenized CSS Modules. No new components or dependencies; `docs/CHANGELOG.md` remains append-only. This batch does **not** include invoice line/queue changes.
- **Test gate:** `npm install` and `npm run build`; create and edit customers, verify field persistence and max-length errors; create/edit both product and service items with a synced list, an empty/pending/unavailable list and a formerly saved draft code; test item-type change clears its old code; verify units, tax rates and existing mappings still work. Test direct catalogue drawer and invoice-editor quick-create in both themes, mobile, keyboard, and Apache-served CSP. The user-owned `.htaccess` must retain PDF `wasm-unsafe-eval` and `connect-src data:`.

**Phase 2a / batch 2 — Invoice classification and backend snapshots (2026-11-07):** The existing `src/pages/invoices/InvoiceEditor.jsx` line metadata shows each catalogue item's `nrs_item_classification_code` as a local HS goods or service code, or a visible missing-code warning. The pure `invoiceLineClassification.js` helper compares the current catalogue data with `nrs_item_classification_snapshot` and `firs_item_type_snapshot` returned by `GET /invoices/:id` for saved editable documents; the UI explicitly warns that saving a draft refreshes snapshots from the then-current catalogue. Switching selected items or using quick-create clears the old displayed snapshot. **Never submit line snapshot fields from the browser**: PHP `invoiceCalculatePayload()`/`invoiceInsertLines()` controls the authoritative saved snapshots. These local records do not imply NRS validation or live submission. No new route/permission/dependency/component; existing line grid and responsive design remain in place. Before marking complete, build and test new/reopened/rejected invoices, goods/service codes, missing codes, changed catalogue values, quick-create, keyboard, both themes, mobile and built Apache CSP. Next: overdue B2C queue reporting on the invoices list.


**Phase 2a / batch 3 — Invoices local NRS queue monitoring (2026-11-07):** The `Invoices` screen independently reads `GET /firs/submission-queue`, which is authorised by `invoices.view`. Its `b2c_overdue_count` is organisation-wide and **not filtered by the current invoice page or search**. The local `invoiceQueueStatus.js` helper validates the API's `mode: 'dry_run'`, `external_submission_enabled: false`, jobs array and nonnegative count; do not show a misleading zero on failure or on a changed API contract. The warning banner exposes overdue 24-hour B2C reporting jobs, a refresh button and a separate unavailable/retry state. The table and mobile cards show verified **local queue** status for approved invoices found in the response, B2C deadlines as **server-local SQL times** (no timezone conversion), and dry-run preview metadata. The endpoint only returns the latest **100** jobs; missing approved invoices are marked **not in recent queue**, *never* assumed to have no job. Awaiting-approval invoices are not shown as submitted. These indicators are not official IRN/QR/CSID, NRS validation, clearance or evidence of live submission. No frontend upload/send operation was added. No PHP backend, routes, permissions, package dependencies, document system or CSP updates.

**Batch 3 test gate:** `npm install` / `npm run build`; check 0/1/many overdue B2C jobs with mixed B2B and B2C approvals, overdue vs upcoming `due_at`, no-queue approved invoices outside the latest 100, disabled queue/403/5xx/unexpected response, manual retry/refresh, invoice search/pagination (which must *not* change the organisation-wide overdue count), archive refresh, loading/empty states and mobile table cards. Verify reading on light/dark and keyboard, plus built Apache `.htaccess` CSP. A `dry_run_at` flag means the *preview* ran, not that an invoice was submitted. **Next:** other Phase 2a existing screens (document evidence/customer portal and compliance settings), in approved batches.


**Phase 2a / batch 4 — NRS production evidence in shared documents (2026-11-07):**
- `src/components/documents/documentModels.js` propagates `nrs_evidence` from authenticated `invoice`, `credit_note` and `payment` document data to a shared `nrsEvidence` model property; proforma and delivery notes have no NRS evidence section. The backend's `payment_receipt` document type maps to the existing `payment` payload key. Also recognise the API's `proforma_invoice` portal type (as an alias for the existing proforma model).
- `DocumentSheet` renders `NrsDocumentEvidence` on fixed white paper for screen, browser print and the existing public customer portal. `pdf.jsx` renders `NrsPdfEvidence` from the same model with **vector QR paths** produced by the already-installed `qrcode.react` encoder. The PDF font normalisation deliberately **does not alter** signed/opaque NRS evidence fields (especially `qr_payload`). Both renderers use the existing `hasProductionNrsEvidence` gate: `verified: true`, `environment: 'production'`, nonempty `verified_at`, `irn`, `csid`, `qr_payload`. Only then show "Confirmed by NRS", IRN, CSID and a QR encoding **exactly** `qr_payload`; otherwise show **"Not yet submitted to NRS"**. Never synthesize a QR from an invoice number, use sandbox/queue data or display mock credentials.
- **Backend changes needed (not part of this frontend-only batch):** `customerPortalAccessLink()` calls `customerPortalDocumentPayload()`, which returns the document service payload *without* `nrs_evidence`; authenticated `GET /invoices/document`, `GET /credit-notes/document` and `GET /payments/document` endpoints already append it. After security review, add the same organisation-scoped, read-only `nrsDocumentEvidence()` adapter for the supported document types to the **public portal access payload**; validate that the link is valid, unexpired and tied to the document's own organisation before fetching evidence. Do not expose evidence-write APIs. Until that backend patch is separately approved, portal documents accurately show the neutral notice, even if authenticated document endpoints have confirmed evidence.
- No change to routes, app guards, permissions, backend, CSP, tokens or package dependencies. The portal obtains document data from its existing endpoint; the shared model handles optional evidence automatically. PDF remains dynamically loaded and retains the owner's `wasm-unsafe-eval` / `connect-src data:` Apache CSP exceptions.
- **Test gate:** run `npm install` / `npm run build` and verify invoice/credit-note/receipt with absent/sandbox/unverified/incomplete/verified-production evidence in both rendered document and downloaded PDF; scan QR and compare its decoded value *exactly* to `qr_payload`. Confirm no QR for unverified values, no NRS evidence section for proforma/delivery note, no raw evidence payload in UI logs, and full PDF print in light/dark/mobile. On public portal, expect neutral status until the documented backend response change. Test built `dist/` through Apache with its actual `.htaccess` and ensure no CSP violations.


**Phase 2a / batch 5 — Organisation Settings + NRS issuer compliance fields (2026-11-07):**
- `/app/settings/organization` is now a real workspace page, under its **unchanged** `PermissionRoute permission="organization.manage" feature="organization_settings"`. It uses the redesigned AppShell, PageHeader, token-based CSS Module, TextField, Select, Textarea, Switch, Checkbox, Drawer, ConfirmDialog and Button; never copy the old settings UI. Five tabs use existing `onboardingService` endpoints: business profile, invoice defaults, compliance profile, payment accounts and branding. Loading/error/retry, save validation and success/error toasts are required.
- The onboarding compliance step and organisation compliance tab both render `NrsIssuerFields` for `nrs_business_id`, `nrs_service_id`, `nrs_postal_zone`, `nrs_state_code`, `nrs_lga_code`. All five are **optional** and saved through `PUT /organization/compliance-profile`; follow the backend maximum lengths/UUID/service ID regex defined in `validateNrsIssuerFields`. NRS business and service IDs must be explicitly issued by NRS. `nrs_mbs_status` and `integration_environment` are server-owned **read-only** values. Do not imply platform licence, certification or live NRS submission.
- Invoice defaults include the backend's FIRS fields, options and local-readiness toggle. When `/firs/options` is unavailable, preserve existing saved codes and permit editing ordinary settings; do not silently overwrite a stored code. B2B document defaults must use `tax_invoice` before save. Payment-account changes require their respective API calls; removal uses ConfirmDialog. Logo preview is an authenticated blob URL and must be revoked on cleanup; PNG/JPG/WEBP max 2MB. This batch does **not** implement archival of the workspace; obtain approval for that destructive flow.
- **Deployment QA:** `npm install` + `npm run build`; verify all five tabs, full reload/persistence, invalid/empty/valid NRS identifiers, all compliance toggles and VAT requirements, optional FIRS resource outage, account creation/edit/delete, logo load/upload/delete, onboarding progression and saved NRS values. Verify permission and feature guard, phone/tablet responsiveness, keyboard, reduced motion, both themes. Always serve `dist/` through Apache with the actual `.htaccess` when testing CSP (Vite dev server does not enforce it), and preserve the project owner's verified `script-src 'wasm-unsafe-eval'` and `connect-src data:` allowances for PDF generation.


## Phase 2b / batch 1 — Invoice Details (2026-11-07)

- `/app/invoices/:id` now loads `src/pages/invoices/InvoiceDetails.jsx` using the **existing** `invoices.view` route guard. It reuses the redesigned customer-details and invoice-editor card language, the shared status badges/forms/modals, and **the same `DOCUMENT_TYPES.invoice.build()` model** used by the customer portal. Screen preview is fitted to the available width; PDF uses the lazy `renderDocumentPdf`, and browser print uses a separate white-paper portal in `invoicePrint.css` so navigation and app controls are excluded from the print job. No old markup, CSS or animation was copied.
- `GET /invoices/document?id=` provides the invoice, organisation and delivery history; the organisation logo is separately loaded as a data URL from the authenticated existing endpoint. The page handles skeleton, missing invoice, network failure/retry, approved/draft/returned/pending states, invoice/customer/payment snapshots, allocations, status history, and saved `nrs_item_classification_snapshot` / `firs_item_type_snapshot` on every line. Line classification remains **backend-owned**; the page never sends or modifies it.
- Workflow actions reuse the existing routes and permissions: draft/returned edits, submit (`invoices.edit`), approve/return (`invoices.approve`), archive draft (`invoices.edit`), send (`invoices.send`), invoice-scoped payment allocation (`payments.record`) and secure customer link issue/revoke (`portal_links.manage`). Payment amounts are limited to the outstanding balance, with backend verification remaining authoritative. Send supports branded template or PDF attachment, with a 4 MiB maximum as in the legacy frontend. Links have a selectable expiry and are only exposed with their original URL immediately after creation. Credit Note Details is implemented in Phase 2b / batch 2; credit-note list/editor in batch 3. Delivery-note screens remain a later build step.
- `POST /firs/invoice-readiness` runs only for approved invoices. `invoiceDetailsModel.js` intentionally accepts persisted validation only when `nrs_last_response.mode === 'local_readiness_only'` (never show production/sandbox transport data as an offline check). The UBL card displays actual backend error/warning fields and the latest eight local checks; a status of **Ready locally** does *not* mean NRS acceptance.
- `GET /firs/submission-queue?invoice_id=` shows the per-invoice dry-run job (when returned) and the organisation-wide B2C overdue count via the pre-existing strict `readInvoiceQueue` guard. It never assumes a missing job was not queued, never converts an API failure to zero overdue, and displays SQL `due_at` as **backend server time**, without browser-timezone conversion. The page and its document use `hasProductionNrsEvidence` for verified, production-only identifiers; without qualifying evidence the public-facing status remains **Not yet submitted to NRS**. Neither queue nor local readiness implies live NRS reporting.
- **No new backend endpoints, dependencies, CSP changes or permissions.** The earlier separately pending public customer-portal read-only `nrs_evidence` API extension still applies. The owner's corrected Apache `.htaccess` (including react-pdf WASM and data allowances) is untouched.
- **Verification gate:** Source-level JSX/JS parse, relative-import checks, CSS checks and contract helpers run offline. Full Vite build and authenticated browser/PHP integration are not claimed. Test draft/returned/pending/approved workflows and permissions; invoice snapshot line codes; local UBL blocked/passed/no-check states; B2C overdue and B2B queue with error/retry; payment over-allocation; secure link create/copy/revoke; email delivery (template and PDF attachment); print/PDF with missing/sandbox/verified production evidence; logo and QR scanning; both themes, keyboard, mobile, and a built app served through Apache with the actual CSP.


## Phase 2b / batch 2 — Credit Note Details (2026-11-07)

- `/app/credit-notes/:id` lazily loads `src/pages/creditNotes/CreditNoteDetails.jsx` inside the existing `credit_notes.view` guard. Phase 2b / batch 3 now also implements the list and new/edit routes, each retaining its original view/create/edit permission guard.
- The page reads `GET /credit-notes/document?id=` (credit note, organisation, 12 most recent deliveries), authenticated logo, source-invoice balances, customer snapshot, credited line amounts, credit reason, actor and status history. The display uses shared Invoice Details cards and shared `DOCUMENT_TYPES.credit_note.build()` paper model, with small credit-specific CSS. Credit note line items do **not** carry the invoice-specific `nrs_item_classification_snapshot` fields in the current backend schema, so the UI never invents them.
- Workflow: submit/re-submit and archive editable drafts (`credit_notes.edit`); approve or return pending credit notes with a required correction reason limited to 500 characters (`credit_notes.approve`). Approval applies the credit to the source invoice balance. Edit controls require `credit_notes.edit`; the source invoice link appears only with `invoices.view`.
- Customer-facing print, lazy PDF download and email delivery (template-only or base64 PDF attachment limited to 4 MiB) unlock **only after approval**. Uses `credit_notes.send` and `POST /credit-notes/send` for email. The existing secure-link dialog is now backward-compatible and reusable for `document_type='credit_note'`, still protected by `portal_links.manage`, retaining immediate-only URL display and create/list/revoke.
- `POST /firs/credit-note-readiness` runs an offline UBL v1.1 validation and returns `data.ubl_validation`. **Unlike invoice readiness, this result is not persisted by PHP.** Show it as current-page state only and clear it upon reload. The panel and document do not imply submission or approval by NRS. Official IRN/CSID/QR remain behind `hasProductionNrsEvidence`; otherwise show **Not yet submitted to NRS**. Credit notes do **not** use the invoice-only submission queue.
- **No backend modifications or new npm dependencies**, no CSP replacement. The approved Apache CSP still requires `script-src 'wasm-unsafe-eval'` and `connect-src data:` for react-pdf. The public customer portal's authenticated-evidence parity adjustment identified in Phase 2a / batch 4 remains pending separate approval.
- Local QA: run `npm install` and `npm run build`; test missing/archived record, network failure/retry, all four statuses, role restrictions, correction reason missing/overlength, source invoice cross-permission, approval balance recalculation, local preflight failed/passed/errors, preview/PDF/print, template vs PDF attachment and 4 MiB limit, secure link create/copy/revoke and link-expiry, missing/sandbox/verified NRS evidence, long content, both themes and mobile/keyboard. Always validate PDF and Google/Paystack under the **built** Apache-served CSP; Vite dev bypasses the CSP.


## Phase 2b / batch 3 — Credit Notes register and draft editor (7 Nov 2026)

- **Routes:** `/app/credit-notes` → `CreditNotes.jsx` under `credit_notes.view`, `/app/credit-notes/new` → `CreditNoteEditor.jsx` under `credit_notes.create`, `/app/credit-notes/:id/edit` → the same editor under `credit_notes.edit`. Details route and its existing workflow remain unchanged. No permission or guard removed.
- **Register design:** follows the approved Customers Sample A/Invoices patterns: `PageHeader`, five scoped KPI cards (only the grand total is organisation-wide; status/value numbers are current-page only), `FilterBar` with debounced search and status, `DatePicker` range, `DataTable` with mobile cards, `Pagination`, icon actions and `ConfirmDialog`. List data comes from `GET /credit-notes`, with server filters and pagination; archive uses `DELETE /credit-notes` only for draft/returned notes and only with `credit_notes.edit`.
- **Draft editor design:** uses the existing Invoice Editor CSS Module for page/breadcrumb/panels/sticky summary and a small credit-specific module for creditable-line cards. `GET /credit-notes/show` hydrates editable drafts; `GET /credit-notes/source-invoice?invoice_id=` supplies server-validated approved invoice lines and remaining quantities; approved-invoice search calls `GET /invoices?status=approved&search=` (50 items/query, not a limited static dropdown). Supports preselection via `?invoice=` or `?invoice_id=` and locks source invoice on edit. `POST /credit-notes` / `PUT /credit-notes` persist a draft; optional `POST /credit-notes/submit-for-approval` follows a successfully saved ID. If submission fails after save, report that **the draft was saved** and navigate to its details so it can be resubmitted.
- **Validation:** source invoice must be approved and available; date cannot precede source invoice; category is one of the backend's five allowed values; reason 5–500 characters, optional external reference ≤120 and notes ≤2000; selected unique lines between 1 and 100 with positive quantities up to 10,000 and four decimal places, not exceeding remaining original quantities. Price, discounts, tax and totals are never sent or calculated as authoritative client values. The preview is explicitly an **estimate**, because PHP rounds each source component in kobo.
- **Remaining backend permission issue (not modified in frontend-only phase):** `GET /credit-notes/source-invoice` currently requires `credit_notes.create`, including when the *edit* form loads quantities for an existing draft. Someone with `credit_notes.edit` but not `credit_notes.create` will receive 403 and cannot complete an edit. Separately, invoice search requires `invoices.view`, which may not be granted to every `credit_notes.create` role. If those combinations are intended, revise backend read permissions through a separately approved security review, preserving organisation scoping and approved-source validation. The UI shows the real error and does not bypass permissions.
- **Local release gate:** `npm install` and `npm run build`; verify approved invoice search beyond 100 records, preselection, missing/unauthorised source, fully credited lines, pending credits, edited returned drafts, 4-decimal and over-credit validation, save/submit partial failure, archive, status/date/search pagination, keyboard, mobile and light/dark. Re-test built Apache/CSP PDF exports on Credit Note Details; the user's corrected `.htaccess` remains untouched. No NRS live submission or verification is claimed.


## Phase 2b / batch 4: Proforma Invoices (7 Nov 2026)

- Routes: `/app/proforma-invoices` and `/:id` require `proformas.view`; `/new` requires `proformas.create`; `/:id/edit` requires `proformas.edit`. `proformas.send` controls email, `portal_links.manage` controls sharing; draft archiving is `proformas.edit`. All retain existing app/subscription/MFA guards.
- Backend (read-only): `GET /proforma-invoices` filters `search/status/date_from/date_to/page/limit`; `GET /proforma-invoices/show?id=`, `GET /proforma-invoices/document?id=`, `POST /proforma-invoices` and `PUT /proforma-invoices` with `save_action='draft'|'issue'`, `DELETE /proforma-invoices`, `POST /proforma-invoices/send` with `delivery_mode='template_only'|'pdf_attachment'`. Only drafts may be edited/archived; only issued proformas may be sent. Proforma number/totals are exclusively PHP-assigned.
- New screens reuse the approved Invoice list KPIs/FilterBar/DataTable/mobile cards/Pagination, approved Invoice Editor panels plus Customer/Item/Payment Account drawers, and Invoice Details card/DocumentSheet/PDF/print pattern. Reuse existing `src/pages/invoices/{InvoiceEditor.module.css,Invoices.module.css,InvoiceDetails.module.css,invoicePrint.css}`; `Proforma.module.css` contains only a small local disclaimer/error treatment. No new reusable component or dependency. `proformaModel.js` is business logic, not UI.
- `InvoiceSecureLinkDialog` accepts existing `documentType='proforma_invoice'`, supported by PHP `customerPortalService`; links remain subject to backend issued-only checks. Public portal already maps this document kind to the shared proforma template. No NRS evidence section is added for proforma or delivery notes.
- **Verification gate:** `npm install` / `npm run build`; test draft create/edit/reload/archival; direct issue and issue-after-edit, irreversibility, missing/invalid item, tax/discount/quantity/date, mixed-currency item/payment selection, quick-add drawers, paging/filtering, and read/create/edit/send permissions separately. Test issued-only print/PDF/email (template and under/over 4 MB PDF), delivery history, secure-link create/copy/revoke, errors/loading, light/dark/390px mobile and keyboard. Serve the built app through Apache `.htaccess` and verify PDF under the enforced CSP (`'wasm-unsafe-eval'` and `connect-src data:`). No claim of browser QA without running it.
- This is DigitalInvoice commercial-document functionality, **not** an NRS-required tax-invoice submission. Never give issued proformas official clearance, IRN/CSID/QR badges or live submission claims. NRS service-provider licensing and live submission remain out of scope.


## Phase 2b / batch 5: Delivery Notes and sidebar audit (7 Nov 2026)

- **Sidebar audit:** `src/config/navigation.js` already listed all seven Sales register destinations (Customers, Products & Services, Invoices, Proforma Invoices, Delivery Notes, Credit Notes and Customer Portal), but the Sales group was initially collapsed on desktop and the mobile Sales tab opened Invoices instead of showing a document selector. `AppShell.jsx` now opens the permitted Sales group by default in the expanded desktop sidebar and makes the mobile Sales tab open a focused, keyboard-accessible Sales navigation sheet. The collapsed desktop rail retains the group fly-out; More retains the full navigation. Existing `canSeeNav` and `filterNav` checks still enforce permissions **and** plan entitlements. If the current user's role/plan does not grant `proformas.view`, `delivery_notes.view` or `credit_notes.view` and its corresponding feature, those entries correctly remain hidden. Creating/editing/detail URLs are intentionally reached from their register, not duplicated as sidebar menu items; the profile remains in the account menu.
- **Routes:** `/app/delivery-notes` and `/:id` require `delivery_notes.view`; `/new` requires `delivery_notes.create`; `/:id/edit` requires `delivery_notes.edit`. The paths and existing auth/subscription/MFA guards are unchanged; only placeholder elements are replaced. Sending requires `delivery_notes.send`, managing a secure link `portal_links.manage`, and opening the linked invoice in-app requires `invoices.view`.
- **Backend (read-only):** `GET /delivery-notes` with `search`, `status=all|draft|issued`, `date_from`, `date_to`, `page`, `limit`; `GET /delivery-notes/show?id=`, `GET /delivery-notes/source-invoice?invoice_id=`, `GET /delivery-notes/document?id=`, `POST/PUT /delivery-notes` with `save_action=draft|issue`, `DELETE /delivery-notes` (archive draft), and `POST /delivery-notes/send` with `delivery_mode=template_only|pdf_attachment` and optional base64 PDF up to 4 MiB. Source invoice must be approved. Validation uses a real delivery date no earlier than the invoice date, selected quantities above zero and no greater than the balance after prior *issued* deliveries, with max four decimals, and field-length limits of 1,000/100/2,000 characters for address/reference/notes. PHP alone assigns issued document numbers and controls snapshot/remaining quantities.
- **Design:** register mirrors Customers Sample A / Invoice list, editor mirrors Invoice Editor Concept A (two-column panels, line cards, sticky summary) and details mirrors Invoice Details / Customer Portal paper display. Shared `DocumentSheet`, `DOCUMENT_TYPES.delivery_note`, lazy `pdf.jsx`, `invoicePrint.css`, `InvoiceSecureLinkDialog` and forms are reused. Local CSS uses semantic tokens, Sora/font-scale and mobile breakpoints; no legacy markup/styles were introduced. Delivery Notes are fulfilment documents, **not** NRS e-invoices or NRS clearance.
- **Existing backend issue:** `GET /delivery-notes/source-invoice` currently requires `delivery_notes.create` even when a user with `delivery_notes.edit` is editing an existing draft. This should be changed under separate backend approval to allow the appropriate read/edit permission; the frontend does not bypass it. Source selection on new documents also requires `invoices.view`. The outstanding customer portal NRS evidence response extension remains unrelated and pending.
- **Verification gate:** build locally with `npm install` and `npm run build`; test navigation in expanded/collapsed desktop sidebar and mobile Sales/More sheets under several permission and plan combinations, keyboard focus/Escape/backdrop, active route/highlight. Test issued-only customer output, first/second partial deliveries, exhausted quantities, date/precision limits, draft edit/archive, irrevocable issue, direct deep links, email with/without PDF, secure link issue/copy/revoke, logos, dark/light themes and 390px mobile. Test PDFs with the built app under Apache `.htaccess` CSP (`'wasm-unsafe-eval'`, `connect-src data:`). No browser/AJAX/backend integration is claimed in this environment.


### Phase 2b / Batch 6 — Payments register and Payment Details (2026-11-07)

- `/app/payments` and `/app/payments/:id` replace only their placeholders within the **unchanged `payments.view` guard**. The Payments sidebar and mobile-tab destination already exist in `src/config/navigation.js`; no added menu link is needed. There is no separate create route: `PaymentRecordDialog` opens from the register, then navigates to the new receipt details page.
- The register follows the approved Customers Sample A / Invoices pattern: five quiet KPI cards, URL-synchronised search plus status/payment-method filters, paginated DataTable/mobile cards, responsive empty/error/loading states and permission-gated record action. The backend GET `/payments` supports `search`, `status`, `method`, `customer_id`, `page`, `limit` but **not a date filter**; do not add a nonfunctional date control. Count cards on the visible page are explicitly labelled and must not aggregate money across NGN/USD/GBP/EUR.
- `POST /payments` requires `payments.record`, returns the new receipt with `customer_id`, date, currency, amount, method, optional bank/reference/payer/notes and optional allocations. Batch 6 records an **unallocated** receipt first; allocate afterward in Details with `POST /payments/allocate` (`payment_id` and `allocations: [{ invoice_id, amount }]`). `GET /invoices/outstanding` requires `invoices.view` and returns up to 200 approved outstanding invoice options, scoped in the UI to the receipt customer and currency. The backend rechecks amount, balance, currency, customer, void and duplicate-invoice conditions atomically; the frontend uses integer minor-unit validation and never overrides settlement totals.
- `/payments/document?id=` returns `{ payment, organization, delivery_history }` (plus NRS evidence on `payment`), used by the shared `DOCUMENT_TYPES.payment_receipt`, `DocumentSheet` and lazily imported PDF renderer. `POST /payments/send` requires `payments.send`; `pdf_attachment` has a **4 MB limit** and only PDF content, otherwise use template-only email. `POST /payments/void` requires `payments.void` plus a 500-character mandatory reason and reverses allocations; do not allow delivery of void receipts. Reuse `InvoiceSecureLinkDialog` with `documentType='payment_receipt'` only when `portal_links.manage` and non-void status.
- `src/components/nrs/nrsEvidence.js` remains the production-verification gate for the shared receipt document. No payment action alone constitutes an official NRS submission. Backend is read-only; no new npm package, CSP, theme or permission changes. Previously pending public customer-portal evidence extension remains outstanding.
- QA gate: `npm install && npm run build`, verify list search/filter/pagination, customer-search creation, partial/multiple allocations, over-allocation, nonmatching currencies, void with reason/reversal and permission-only roles, email with/without PDF, secure links, document preview/QR and scan, print/PDF under **built Apache CSP**, long labels and 390px mobile in both themes. If `invoices.view` is denied, the allocation picker will show the backend authorization error; this is not bypassed.

### Phase 2b / Batch 7 — Customer portal links register (2026-11-07)

- `/app/customer-portal` now uses `src/pages/portalLinks/CustomerPortalLinks.jsx` under the existing `portal_links.manage` permission/entitlement guard. The Sales menu already includes **Customer Portal**, both in expanded/collapsed desktop navigation and the mobile Sales sheet; no new menu destination or permission is required. The UI uses the established Customers Sample A / Invoices list design: PageHeader, scoped quiet KPI cards, FilterBar, DataTable, local Pagination, compact mobile cards, StatusBadge, and ConfirmDialog for irreversible actions.
- `GET /portal-links` without filters returns only the newest **80 links** by ID; unlike the document-specific query (`document_type` + `document_id`, latest 20), it has **no server-side pagination or global aggregate**. On this register, search/document/status filters and pagination are strictly client-side over those returned records. The five cards explicitly describe **recent links** and **views across recent links**. Never label the sample as the organisation-wide total or imply a missing older link never existed. The backend computes `is_revoked` and `is_expired` at request time, so refresh to update time-based statuses. List items provide document ID, type, title, recipient, timestamps, access count, creator and revocation metadata, **but no token or `portal_url`**. Do not offer a fake Copy/Open customer-link control.
- New links remain created in the existing document-specific Secure Link dialog using `POST /portal-links`, which checks valid source-document state and exposes the unguessable URL **only on that response**. Guide users to their permitted document register instead of asking for raw record IDs or pretending the management list can recover secret URLs. Revocation via `POST /portal-links/revoke` uses a destructive ConfirmDialog, clear error feedback and backend response refresh. A source-document action requires that document's `.view` permission; the destination route continues entitlement enforcement.
- `src/pages/portalLinks/portalLinkModel.js` contains the pure response and status adapters, filter/count logic and permission-aware source paths; its CSS Module supplements existing Invoice register styles with token-only metadata layout. No separate component or dependency is introduced. Backend and Apache CSP are unchanged. NRS official evidence still requires the existing production verification gate; link metadata is not evidence of NRS clearance.
- **QA gate:** `npm install && npm run build`, test 0/1/80+ links (backend caps at 80), local search/type/status filters, paging and refresh, API 403/5xx/malformed response, revoked/expired precedence, quick links under each role/plan, revoke cancel/confirm/error, and one-time creation URL (only from the document dialog). Confirm revoked URLs return 410 from the public portal, keyboard focus/confirmation behavior, long document titles and recipient emails, light/dark 390px mobile, and built Apache `.htaccess` CSP. The known public-portal NRS evidence extension remains a separate backend change.


### Phase 2b / batch 8 — Workspace Dashboard (7 November 2026)

- `/app/dashboard` now lazy-imports `src/pages/dashboard/Dashboard.jsx` behind the existing `dashboard.view` permission guard; sidebar and mobile Dashboard links already exist. All destination shortcuts check view/create permission **and plan entitlements**. No CSS, menu, CSP or backend alteration.
- Read-only API: `dashboardService.summary({from,to,currency})`, `.trends({from,to,currency})`, `.recentActivity({limit:8})`, using `GET /dashboard/summary`, `/trends`, `/recent-activity`. The backend's period defaults are month-to-date, with a maximum span of 3 years; frontend uses existing period presets, validates start/end dates, and sends a single ISO date range and selected currency. Do not aggregate across currencies.
- Cards use *server summary* amounts from approved invoices, receipts, outstanding/overdue, pending and VAT. All-time customer/item counts are explicitly labelled organisation-wide; activity is latest irrespective of selected date range. Recent invoice/payment records are five rows **within the chosen range**, as supplied by the backend; they are not query-wide counts. The chart is a **separate lazy chunk** using existing `recharts`, switches between daily/monthly data according to backend `granularity`, and includes an accessible data table. No NRS clearance is implied: show the backend disclaimer and identify `nrs_awaiting_submission` as local-only.
- Each endpoint has an independent error state and retry; an invalid response never becomes a false zero. Skeleton, true empty dataset, getting-started, partial-data failure, long names/IDs and keyboard states must be tested. Custom range supports valid dates and a maximum of 3 years; presets are from `src/utils/dashboardFilters.js`. Reuse `PageHeader`, `Button`, `DatePicker`, `Select`, `Alert`, `Skeleton` and `StatusBadge`; no legacy markup/CSS.
- Local QA gate: run `npm install`, `npm run build`, test 390/768/1024/1440px and both themes, period/currency changes with real PHP data, three independent API failures, long chart ranges, chart loading, zero activity, actions available only to permitted/entitled users, keyboard and screen reader, and the **built app served via Apache with owner-corrected CSP**. Backend adjustments: none. Next: Reports overview and individual reports under the existing `reports.view` guard.

### Phase 2b / Batch 9 — Reports hub and reporting screens (7 November 2026)

- `/app/reports` and `/app/reports/{invoices,payments,receivables-aging,customer-statement,vat-summary,compliance-readiness}` now lazy-load the redesigned reporting pages within the pre-existing `reports.view` guard and Reports navigation. The UI follows Customers Sample A/Invoices register layout and the Dashboard's Sora KPI cards, token surfaces, shared filters, responsive DataTable and accessible actions. The old frontend is a **behavior/API reference only**.
- **Exact report endpoints:** `reportService.invoices`, `.payments`, `.receivablesAging`, `.customerStatement`, `.sendCustomerStatement`, `.vatSummary` and `.complianceReadiness`. The PHP API returns `data` directly inside the success response; `readReport(response, type)` checks expected keys instead of converting invalid responses to empty values. Applying a filter starts a new request; draft filter edits do not silently change currently displayed results. Periods obey `YYYY-MM-DD`, `from <= to` and at most 366×3 days.
- Invoice and payment registers support server `page`/`limit` (maximum 100), status, optional payment/NRS status or method, date/currency and search; their summary totals cover all matches, but **CSV downloads export only the shown server page**, clearly noted. Receivables aging (`aging_date`) uses the **current** outstanding balance (not a historical snapshot), with up to 200 detail rows. VAT Summary has up to 200 invoice detail rows, plus the complete tax-treatment grouping and a tax-remittance disclaimer. Neither 200-row cap should be represented as a complete data export.
- Customer Statement requires a selected customer, currency and date range. It uses the PHP `customer-statement-v1` contract and displays approved invoice debits, approved credit-note credits, non-void payment credits and running balances. Export through dynamic imports: `xlsx` only when requested and `@react-pdf/renderer`/Sora/Inter fonts only for PDF or attachment. The optional `POST /reports/customer-statement/send` action requires `reports.send`; validate recipient email, name ≤120 characters, message ≤1,200 characters, PDF `application/pdf` and ≤4 MiB. Never attach a PDF of a different customer/period than the submitted send filters. Email-log mode may indicate recorded delivery without sending; respect the API response wording.
- Compliance Readiness has no date or currency filters because the existing backend endpoint is organisation-wide. Show profile capture checks and database statuses separately from live NRS submission; the backend hard-codes `submission_enabled: false`. The latest-twenty pending list is **not** the entire backlog. Do not add amounts across currencies in the status breakdown. Future live NRS status requires a separately authorized, audited backend rollout.
- **Manual QA gate:** run `npm install` / `npm run build`; verify report data/filters/page totals against real PHP fixtures, the 200-row detail limit, multi-currency isolation, 3-year validation, search length, empty/error/retry states, customer async search, statement running balances, all export formats and Excel sheet types, 4 MiB PDF attachment behavior, `reports.view` vs `reports.send` roles/entitlements, keyboard and mobile (390/768/1024/1440px), both themes, and PDF/email from the **built app served by Apache with the corrected CSP**. The Vite development server is not a valid CSP test. Backend and owner-corrected `.htaccess` remain unchanged; no new dependencies.


### Phase 2b / batch 10 — Workspace administration registers (source-implemented)

- **Team:** `/app/team` remains behind `team.view` and entitlement routing. `GET /team/members` returns members, still-valid invitations, and **actor-assignable role definitions**. The UI offers invite/role/status/cancel/resend actions only for owner or administrator; self, owner, and (for non-owner actors) administrator accounts cannot be modified. The backend is still authoritative. Role and status changes revoke the affected user's sessions; invitation resends replace the previous token. Invitations are not publicly re-copyable, except a backend development-only response. Counts refer to the returned organisation membership/invitation arrays, not plan seats.
- **Tax rates:** `/app/settings/tax-rates` uses existing `referenceService` endpoints. Read-only members see active rates; members with `tax_rates.manage` can see inactive rates and create/update/deactivate. Validation matches PHP: code max 40 and `[A-Z0-9._/-]`, treatment is `standard`, `zero_rated`, `exempt` or `non_taxable`; percentage 0–100 and at most four decimal places. Inactive default is forbidden; the backend prevents deactivating a rate still used by active items. NRS submission status is unrelated to rate configuration.
- **Activity Log:** `/app/activity-log` keeps the existing `organization.manage` + `activity_log` feature check. Filter/search/date/pagination parameters are sent to `GET /activity-log` (server-side, at most 100 rows per request). Summary cards are **organisation-wide last 30 days**, not filtered totals. Table records are scoped to the applied search/group/date filters. Metadata is not dumped into the UI. This activity feed is not an immutable compliance audit guarantee.
- Existing desktop/mobile Administration navigation entries already point to these routes. The route placeholders are replaced without loosening permissions or entitlements. A separate next batch covers `/app/profile` and its MFA security card. Browser checks should include owner/admin/accountant/viewer roles, expired invitations, revocation of sessions, draft tax rate dependencies, network error/empty/filter states, keyboard/modals, both themes, responsive tables and Apache built-app CSP.


### Phase 2b / batch 11 — Workspace Profile and MFA account settings (2026-11-07)

- `/app/profile` now lazily loads `src/pages/settings/Profile.jsx` under the **existing authenticated/workspace/subscription/onboarding guards**. No extra permission is required to manage one's own account; the account menu already links there. The screen reuses `PageHeader`, `TextField`, `PasswordField`, `PasswordStrength`, `Alert`, `Button` and Sora/token-based panels in the established settings style. It shows the user, organisation, role and linked sign-in providers, but it never exposes identity provider IDs. Only `name` (2–120 characters) is editable through `PUT /user/profile`. The profile payload and the name saved on the backend are kept separate from the session until refresh; session polling must not overwrite unfinished input.
- `PUT /user/password` requires the current password when one exists; supports initial password creation for Google-only accounts; validates the shared 8+ / uppercase / number / special policy and matching confirmation. The PHP endpoint invalidates all sessions and cookies: clear local auth and return to login **only after a successful response**. Invalid old passwords and weak/new confirmation errors stay on the profile screen.
- `MfaSecurityCard` uses `GET /user/mfa`, `POST /user/mfa-setup`, `/user/mfa-confirm`, `/user/mfa-recovery-regenerate`, `/user/mfa-disable`. A current password and a code are needed for management; disabled/setup readiness and role-required states are controlled by the server. Setup QR and copyable manual key are sensitive, ephemeral, and expire in 10 minutes. Confirmation revokes every session; show all newly issued recovery codes **once**, provide copy/file save and require explicit acknowledgment before navigating to login. Recovery-code regeneration remains in the same session but immediately invalidates previous codes. Disabling is only offered for optional MFA; it signs out all devices.
- `useSessionKeepAlive()` now suspends heartbeat while a recovery-code panel is visible inside Profile, not only on `/security/mfa`. No recovery code, secret, password or QR URI is stored persistently or sent to logs. QR paper contrast is fixed as for the already approved enrolment component; all other colours use tokens. The existing owner-corrected Apache CSP is untouched.
- **Next frontend steps:** platform administration screens (including `/platform/profile` with the same MFA component and `/platform/firs-integration` sandbox-only diagnostics), then full interactive QA and API/deployment regression checks. The pending *backend* tasks are separately tracked: public portal evidence response, source-invoice edit-only permission mismatches, and later NRS Step 5+ ERP/API work. Do not imply the production NRS license/connection exists.
- **Local test gate:** `npm install && npm run build`; test both password/Google-only accounts, profile save and unauthorized errors, invalid current password, password reset with forced logout, MFA setup expiry/wrong TOTP/QR scanning, recovery download/copy and acknowledgment, regeneration, nonprivileged disable and mandatory-role disable restrictions. Simulate an expired session while recovery codes are visible to verify the heartbeat exclusion. Check both themes, 390px mobile, keyboard, focus and built Apache-served CSP. Source parsing alone is not a browser or full Vite build.


### Phase 2b / batch 12 — Platform Dashboard, Users and Clients (7 November 2026)

- `/platform/dashboard`, `/platform/users`, `/platform/clients` and `/platform/clients/:id` now use real data from the existing `platformService`. The pages reuse workspace administration's PageHeader, cards, responsive DataTable, fields, StatusBadge and confirmation/modals; new CSS only uses semantic tokens. Access uses the platform role's `platform_access.permissions` rather than workspace plan permissions. A new PlatformPermissionRoute protects these pages, and the platform shell filters its menu accordingly. Legacy `platform_admin` users continue to work. Backend remains the final authority.
- Dashboard revenue figures are NGN *subscription* income; MRR is based on active recurring plans. Client detail revenue is subscription income, never NRS-cleared invoices; mixed-currency client operational totals are not rendered.
- Client listing supports PHP filters but the current PHP route omits `page`/`limit` when constructing the service filter array. It returns only its first 10 matches and must say so. Restore server pagination in PHP before enabling pagination on this screen; never mimic complete results with a truncated set.
- Platform Users management allows only platform owner/admin roles to mutate, with owner-sensitive options hidden from admins and the last-owner/self restrictions enforced independently by PHP. Invitation URL is only disclosed in development/log mode by PHP and is not reconstituted by the frontend. Role/status changes affect access sessions; archiving a client cancels its current subscription and revokes workspace sessions.
- **Next batches**: Platform plans, subscriptions and Premium Requests; revenue/activity; platform profile and settings; sandbox-only NRS/FIRS integration; end-to-end browser/API QA. New platform components are `PlatformDashboard`, `PlatformClients`, `PlatformClientDetails`, `PlatformUsers`, and `PlatformAdmin` styling. No new npm dependencies or backend alterations are made this batch.
- Local QA: npm build, role-filtered desktop/mobile navigation, all permission-denied deep links, first-page client scope, client status transitions with revoked sessions, platform-user role and invitation actions, empty/failed API responses, both themes, 390/768/1024/1440px, keyboard/focus, and built Apache CSP. The Vite dev server does not enforce the production CSP.

### Phase 2b / batch 13 — Platform plans, subscriptions and Premium Requests (7 November 2026)

- Routes: `/platform/plans` (`platform.plans.view`), `/platform/subscriptions` and `/platform/subscriptions/:id` (`platform.subscriptions.view`), `/platform/premium-requests` (`platform.premium_requests.view`). Platform membership and forced-MFA guards still run first. Platform shell already lists these pages and filters the menu by platform access; no duplicate menu entries should be added. All writes check the corresponding `.manage` capability and PHP is authoritative.
- `PlatformPlans` allows authorised users to manage platform pricing, display order, Paystack references, billing intervals, feature lines and `normalizeEntitlements` feature/limit settings. Server discounts/price recalculation take priority. Premium tiers are **contact us**, not a purchasable or NRS-licensed plan. Plan activation/deactivation does not directly cancel existing subscriptions.
- `PlatformSubscriptions` is a truly paginated register. Lifecycle expiry synchronisation can change access; reminder sweeps may send customer emails, so both require confirmation. Backend MRR combines amounts without currency separation and is intentionally not displayed until a by-currency summary is available. `PlatformSubscriptionDetails` has separate status/provider/manual-payment actions with confirmation for customer-impacting changes. Manual payments must be independently verified. Paystack refresh is a live provider read, not permission to override verified provider truth.
- `PlatformPremiumRequests` shows commercial enquiries and editable follow-up statuses/internal notes, with existing assigned staff IDs explicitly preserved on PUT. An enquiry marked converted does **not** create, charge or activate a subscription. Assignment changes are intentionally not offered in this batch.
- **API limitation:** subscription-detail payments are capped at 30, while the payment summary may include all payments for the organisation and plan, not only that particular subscription ID. The client labels the scope and hides mixed-currency paid/lifetime aggregates. A backend by-currency breakdown is needed for accurate monetary summary cards. The PHP service rejects management of inferred-from-payment subscription records; show server errors rather than pretending to update them.
- **QA gate:** Run `npm install && npm run build`; test owner/admin/billing/support/viewer roles and direct deep links, plan validation and premium contact pricing, pagination/filtering with real server data, subscription cancellations/reactivations/extensions, verified manual payments, Paystack verification and refresh, mail reminder de-duplication, full and empty Premium requests, 390px mobile/light/dark/keyboard, and the **built Apache-served app** under the corrected `.htaccess` CSP. No backend, dependency or CSP change in this batch. Remaining platform pages: revenue, activity, profile, settings and FIRS/NRS sandbox integration; then full integrated QA.

### Phase 2b / Batch 14 — Platform Revenue and Activity (7 November 2026)

- `/platform/revenue` is a real lazily loaded page under `platform.revenue.view`. It calls `platformService.revenue({search,status,plan_id,date_from,date_to,page,limit})`, and uses the existing `DataTable`, `Pagination`, `TextField`, `Select`, `DatePicker`, `PageHeader` and alert/empty patterns. Summary counts are **global** except fields explicitly named `filtered_*`; monthly and plan chart bars show **transaction counts**, not amounts. The table uses the `currency` from each payment row. **Do not display** `monthly_revenue`, `lifetime_revenue`, MRR, `filtered_paid_amount`, `plan_breakdown.revenue`, monthly amount or status amount until the PHP backend returns currency-separated equivalents.
- `/platform/activity` is a real lazily loaded page under `platform.activity.view`. It calls `platformService.activity({search,group,actor_id,client_id,date_from,date_to,page,limit})`, keeping URL filters and server pagination. Summary counters are unfiltered across the platform; individual events show the server-provided actor and client and never raw metadata. Actor/client dropdown data is limited by PHP to up to 100 actors and 150 clients: label it as a recent selector, not an exhaustive list. Client links require `platform.clients.view`.
- `platformInsightsModel.js` contains strict response, date, query and filter helpers. `PlatformInsights.module.css` supplements the approved B2 `PlatformAdmin` pattern for accessible token-only count bars and detail text; no new general-purpose component or dependency. Existing platform sidebar and mobile menus already link to these paths; retain their platform permission filtering. Never loosen the global enforced-MFA guard.
- The PHP read endpoints already support pagination; no frontend backend changes are required for this batch. **Backend follow-up:** return by-currency revenue summaries and trends, then audit all platform monetary KPIs, including the existing Dashboard, for mixed-currency aggregation.
- **Local QA:** `npm install && npm run build`; test paid/pending/failed/reversed payments, individual USD/NGN amounts, empty/error data, date range validation, filters and page 2/last page with actual API results, permissions for platform owner/admin/support/billing/viewer, recent selector truncation, both themes and mobile 390/768/1024/1440px, keyboard, and compiled Apache CSP (`.htaccess` is ignored in Vite dev mode). Source-level checks are not live API or visual QA. Next: Platform Profile and Settings, then platform sandbox NRS integration.

### Phase 2b / batch 15 — Platform Profile and Settings (7 November 2026)

- `/platform/profile` is source-implemented for every authenticated platform member. Its `GET/PUT /platform/profile` contract is **not the workspace `/user/profile` contract**: `user`, `organization`, `platform` (role, permission, access status), and `identities` are handled explicitly. Changing a password uses the shared `PUT /user/password` and signs out after backend revocation. The same `MfaSecurityCard` as workspace Profile is used for setup, regeneration, recovery code delivery and optional disablement; platform roles' mandatory MFA cannot be bypassed. Background session refreshes must not reset an unfinished form or close one-time recovery codes.
- `/platform/settings` is source-implemented. Route-level `platform.settings.view` and action-level `platform.settings.manage` checks are separate; PHP enforces both. `GET/PUT /platform/settings` uses `{settings:{...}}` and supports a migration-required read-only state when `settings_table_ready` is false. The table requires `schemas/2026_06_01_add_platform_settings.sql` on PHP. Field length and numeric ranges match PHP's `platformSettingDefinitions`; saving confirms server-normalized values. Unsaved edits block automatic refresh and can be discarded through the shared confirmation dialog.
- Platform Settings shows **configuration health, not secrets**. `paystack_mode` and `compliance_environment` are stored defaults only, never authorization, live NRS submission or a successful gateway connection. Full FIRS/NRS integration UI, including sandbox health, is the following batch. The PlatformShell already links Profile from the account menu and Settings from the platform navigation; do not create duplicate entries.
- Full local QA gate: `npm install && npm run build`, run real PHP GET/PUT with owner, admin, viewer and a user lacking `.manage`, test profile and session revocation, Google-only password, MFA setup and one-time codes, invalid and valid settings, missing DB migration, dirty-state confirmation, dark/light and 390px mobile, keyboard, screen readers, and the **compiled app via Apache** with the corrected CSP (`'wasm-unsafe-eval'` / `connect-src data:`). Source-level parsing is not a live/browser test. No backend or CSP file changed in this batch.

### Phase 2b / Batch 16 — Platform NRS integration and shared modal dropdown correction (7 Nov 2026)

- `/platform/firs-integration` replaces its placeholder with `PlatformFirsIntegration` under `platform.firs.view`. The platform sidebar already points to this route; configuration editing, sandbox HTTP check and local resource updates additionally require `platform.firs.manage`. Reuses shared PageHeader, TextField, Select, Switch, Textarea, Button, Alert, StatusBadge, Drawer and ConfirmDialog. New page-only styles use existing B2 corporate/Sora semantic tokens; responsive grids collapse at 1060/680/540px.
- API: `GET /platform/firs-integration` yields `{settings:{settings,sensitive,flags},summary,resources,recent_logs}`; `PUT /platform/firs-integration` accepts a **diff-only** payload and returns `{settings,overview}`; `PUT /platform/firs-resources` saves `{resource_key,entries}` and returns overview. `POST /platform/firs-sandbox-health` invokes **only** a read-only NRS sandbox currency resource; it requires backend safety conditions and the server's separate `NRS_SANDBOX_HTTP_ENABLED` switch. Secrets are masked in GET, left blank in the editor, and replaced only when explicitly typed. The frontend must never store secrets in localStorage, echo `********` or send locked `firs_enable_live_submission`/`firs_enable_pay_now_links` flags. No production NRS submission UI or licence claim.
- **Global Select inside modal/drawer rule:** the shared `react-select` menus portal to `document.body` to escape the `overflow:auto` content regions. Therefore the portal's `z-index` must be higher than `--z-modal` (not `--z-dropdown`). Use viewport-fixed placement for correctly aligned menus during scrolling. `src/components/forms/Select.module.css` owns the single global portal level; do not add per-dialog overrides or copy CSS into screens. Regression-test in short and tall dialogs, scrollable drawers, mobile bottom-sheet modal, dark/light, keyboard and mouse/touch options, while keeping overlay backdrop click/scroll lock behavior intact.
- Manual QA: save/reload settings; view-only vs manage; secret replacement (never auto-fill saved keys); malformed URL; validation and discard; edit/inactivate resource codes; duplicate codes; failed API request; sandbox disabled by backend/saved gates and successful read-only resource test; recent diagnostics; 390px mobile and keyboard. Build locally and serve `dist/` through Apache with the real CSP, not just Vite dev server. The backend and corrected `.htaccess` are unchanged.

### Cross-stack integration review / correction batch (7 November 2026)

- Canonical audit and release checklist: `docs/INTEGRATION-REVIEW-2026-11-07.md`. This batch contains **separate PHP API and redesigned frontend patches**; apply the API patch first. Do not deploy the new `/platform/clients` pagination UI against an API that does not forward `page` and `limit`; the UI detects a stale API response and explicitly errors.
- The `PUT /platform/client` route was missing from `api/index.php` even though its handler exists. Guard client mutations with platform `platform.clients.manage` in PHP, not just in the frontend.
- Read access to source invoices from credit/delivery editors is granted to users with `*.create` **or** `*.edit`, not `*.view` alone. Both candidate capabilities retain entitlement and operational-workspace validation, and source data remains scoped to the current organisation.
- Public portal document evidence must be attached only after the secure token and document status are validated. Use the exact read-only NRS production-evidence gate; no sandbox/mock evidence or customer portal link implies a production submission.
- Platform financial aggregates can mix currencies in the current PHP service. **Never format unsplit subscription totals as NGN**. Individual transactions must display their original currency until the server reports explicit by-currency summary groups.
- Verify `npm install && npm run build`, Apache deployment with the owner's corrected CSP and actual PDF downloads, mobile/light/dark/keyboard/modal-select UX, PHP syntax and unit tests, owner/viewer/edit-only permission cases, client page 2 and portal evidence. The Vite dev server does not enforce `.htaccess`; source checks are not live verification.


## 2026-11-07 — Step 6: ERP integration management UI

- Route: `/app/settings/integrations` beneath `AuthenticatedRoute` → `SubscriptionActiveRoute` → `OperationalRoute` → `OrganizationAdminRoute`. Only roles `owner` and `admin` may use it; the backend independently enforces that rule. It appears in the **Administration** menu when the owner/admin has `organization.manage`; do not surface the route to ordinary team members.
- UI: `ErpIntegrations` reuses `PageHeader`, `Alert`, `Button`, `DataTable`, `TextField`, `Checkbox`, `Modal`, `ConfirmDialog`, `StatusBadge` and `PageLoader` with existing Sora/tokens/mobile patterns. Three sections: API clients, webhook endpoints, delivery history. The backend currently returns **at most 100** records per register; any displayed count is explicitly scoped to those records, never reported as an all-time count.
- API: `src/services/erpIntegrationService.js` contains cookie-session+CSRF management calls: GET/POST/PUT `/integrations/clients`, GET/POST/PUT `/integrations/webhooks`, and GET `/integrations/webhooks/deliveries`. Strict parsing/validation lives in `src/pages/integrations/erpIntegrationModel.js` and follows Step 5 PHP route response envelopes. These are **not** OAuth bearer-token endpoints.
- Security: `client_secret` and `signing_secret` appear only after successful creation/rotation, never in ordinary list responses, localStorage, URL query parameters or logging. The UI provides user-initiated copy/download and requires a one-time save acknowledgement before dismissal. Rotation revokes existing OAuth tokens (for clients) or replaces the webhook signing key; revocation/disable is confirmed in a destructive dialog. Secrets shown in a modal do not persist after refresh. Do not submit production credentials to test environments.
- Integration flags: the management UI can exist with `ERP_INTEGRATIONS_ENABLED=0` and `ERP_WEBHOOKS_ENABLED=0`; successful creation is not proof that token exchange or outbound delivery is enabled. No live NRS submission, evidence forgery, ERP write endpoints or regulated production status is offered.
- Local QA: apply Step 5 backend migration and configure field encryption; use the built frontend through Apache with the owner's CSP corrections, verify owner/admin vs other roles, light/dark/mobile, keyboard focus, empty/error/retry states, scope restriction, create/rotate/revoke, webhook URL rejection, delivery history and secret acknowledgement. Independently exercise OAuth `client_credentials` and signed HTTPS webhook receipt with a **test** ERP before enabling either flag. Reconfirm `npm install && npm run build` locally; source checks alone do not constitute end-to-end testing.

### Step 7 — ERP integration staging acceptance (7 Nov 2026)

The API's `docs/ERP-INTEGRATION-STEP7-TESTING.md` is the release gate for the Step 6 ERP management screen. Test with a dedicated staging owner/admin and another role: client creation and one-time secret acknowledgment; update/revoke/rotate; webhook destination/event edits that cancel pending old deliveries; retry and HMAC verification; scoped read-only OAuth calls; two-tenant isolation; invalid/expired token handling; both integration feature flags and suspended organisation behavior. Confirm the compiled frontend under Apache CSP in light/dark, modal keyboard interactions and mobile. Do not use real ERP/customer secrets or treat source-only tests as end-to-end verification. This Step 7 patch makes **no frontend code changes** and does not enable NRS production submission.

## Step 8 — historical invoice snapshots and platform currency reporting (2026-11-07)

- The PHP backend must run `migrations/20261107_invoice_buyer_address_snapshots.sql` **before** the updated invoice writer, approval and NRS adapter are deployed. Approved invoice buyer city/postal zone/state/LGA details come only from the saved invoice snapshot; never borrow the current customer record when exporting NRS UBL. Pre-migration approved invoices intentionally remain incomplete without verified original supporting records.
- Platform Dashboard and Revenue money figures use `currency_breakdown`, and Revenue filtered money uses `filtered_currency_breakdown`. **Never sum NGN, USD or other recorded currencies, imply an FX conversion, or relabel the total as NGN.** The older scalar cross-currency amounts are deprecated and null in these two endpoints. Treat a missing/invalid array as an API error, not a zero total.
- Currency summary tables reuse `DataTable` (with `rowKey="currency"`), and mobile cards, grid, color and font rules remain unchanged. No new route, menu, permission, dependency or CSS color was introduced.
- Deployment QA: run backend snapshot/finance tests and DB migration, merge API first, then frontend; build with `npm install && npm run build`; serve the **built** app via Apache to enforce the owner's CSP. Test one NGN and one USD paid subscription, an older approved invoice without buyer details, a newly approved invoice after customer master edits, NRS local readiness warnings, keyboard navigation, mobile and both themes.
- Scope: grouped Dashboard/Revenue reporting only. Other legacy plan, subscription and client monetary summary fields require a separate grouped-currency audit before un-hiding them. NRS production submission remains disabled.

### Step 9 — platform money contract and regression testing (2026-11-07)

- `src/pages/platform/PlatformCurrencyBreakdown.jsx` is the shared platform administration display for strict `[{currency, amount}]` backend amounts; it reuses `PlatformAdmin.module.css` KPI cards, responsive grids and theme tokens. Use only when grouping reflects original transaction currency; never sum different currencies or infer a plan currency from unrelated payments.
- Client, plan and subscription screens require the Step 9 backend fields (`*_by_currency`) and reject missing or malformed data; apply backend before frontend. Deprecate mixed monetary scalar fields by returning `null` and do not interpret null as zero.
- Regression checks: `node tests/platformCurrency.step9.contract.cjs`; `DIGITALINVOICE_API_ROOT=/path/to/api node tests/applicationStep9.contract.cjs`; `php tests/platform_currency_step9_unit.php`. Run all backend unit tests, `npm install && npm run build`, PHP/MySQL authenticated staging checks, and browser testing against Apache's actual Content Security Policy (`'wasm-unsafe-eval'` for PDF layout and `data:` for its module fetch). Test currency groups, permissions, loading/empty/error, light/dark/mobile and keyboard behavior.

## Step 10 — mandatory final QA and Apache deployment gate (2026-11-07)

- Follow `docs/QA-STEP10.md` and the paired API `docs/STEP10-RELEASE-READINESS.md`. Source-level parsing/unit tests are **not** an authenticated MariaDB/Apache/browser release test.
- Run `node --test tests/qaStep10.test.mjs`, `node scripts/qaStep10.mjs --mode=source --csp-file=/path/to/owner-corrected/.htaccess`, `npm ci && npm run build`, and `node scripts/qaStep10.mjs --mode=built --csp-file=/path/to/owner-corrected/.htaccess`. The build output itself **must** contain the corrected `dist/.htaccess`.
- Host `dist/` under Apache and execute `node scripts/qaStep10.mjs --mode=apache --url=https://STAGING-FRONTEND-HOST --api-url=https://STAGING-API-HOST`. The Vite development server ignores Apache CSP. Run actual PDF downloads, Google login, Paystack test, MFA, permissions, 390–1440px light/dark and modal select tests in a browser.
- **Known source mismatch:** the archive used for Step 10 still contains older `public/.htaccess` missing the owner's `script-src 'wasm-unsafe-eval'` and `connect-src data:` fixes. **Do not overwrite the owner's corrected file.** Use it in the release build, and confirm the real Apache response header before release.
- This step adds QA scripts and documentation only. Keep NRS production submission locked, leave ERP integrations disabled pending signed-off external HTTPS/tenant-isolation testing, and do not claim production readiness from a green offline script.

---

## UX correction batches (2026-11-07)

### Batch 1 — navigation and route transitions
- `src/utils/navigationVisibility.js` is the single place for sidebar permission and plan visibility. **Permissions and role restrictions filter routes**; if a permitted route is outside the current subscription, keep it visible with the lock indicator and rely on its existing `PermissionRoute` for the upgrade prompt. Never use the menu to bypass a route guard.
- Keep Sales and Reports **collapsed on first entry**. Only user actions toggle submenus; active pages get a visual highlight but never automatically force the parent open. Avoid grid `0fr`/`1fr` reveal for multirow navigation; use `[hidden]` so all rows appear and closed links are not keyboard-focusable. The collapsed sidebar's group trigger can expand and open its group.
- Sidebar is flush with the left, top and bottom viewport edges on desktop and in the mobile drawer. Internal padding must leave room around links and the workspace dock; do not restore the former outer app-frame margins or large rounded sidebar corners.
- `RouteExperience` resets the document scroller when `location.pathname` changes, not for query/filter or fragment-only changes. Its nonblocking progress indicator is for internal navigation; `AppShell`'s inner Suspense fallback keeps chrome visible while the lazy destination renders. The global Suspense loader remains available for public/auth routes.
- The existing wildcard route renders `NotFound`; verify unknown paths, direct URL refreshes, browser Back/Forward, and authenticated/guest home actions.

### Batch 2 planned — catalogue and units of measure
- Review product vs service required/optional fields and enforce backend-aligned validation; service unit-of-measure must be optional while preserving any valid existing service unit.
- Inspect the PHP unit-of-measure tables and item write endpoints before adding defaults or tenant-defined units. Seed common options idempotently and use server-side authorisation, duplicate handling, tenant scoping and referential integrity; do not simulate unit creation only in frontend memory.

**QA:** `node tests/navigationExperience.batch1.test.mjs`, `npm install && npm run build` in a dependency-enabled environment, then open the **built** frontend under Apache with the owner's CSP to test all screens. Check long Sales menus, theme modes, keyboard and mobile; confirm users without the required permission still cannot navigate into protected screens.


## UX Batch 2 — Catalogue units and optional Service defaults (2026-11-07)

- Catalogue's Service records allow a **blank unit and blank default price**. The PHP API resolves the blank unit to the seeded generic `SERVICE` unit and stores a blank price as `0.00` to keep existing document foreign keys and calculation behavior intact. Products still require a unit and price; both types still require a name and currency. Tax treatment is optional because PHP already resolves the workspace default. This is an **input** convenience, not a nullable invoice-line or item unit foreign key.
- The inline custom-unit panel in `ItemFormDrawer` uses shared `TextField`, `Select`, `Button`, and CSS tokens; no nested modal, extra frontend dependency or NRS certification claim. `POST /reference/units` requires `catalogue.manage`; `GET /reference/units` uses `catalogue.view`. User-defined units are visible **only to the creating organisation**.
- The separate backend migration `20261107_catalogue_units_batch2.sql` seeds 28 common units and creates `organization_unit_ownership` for tenant scoping while preserving existing unit IDs. Unit codes are generated by the server and are not official NRS mappings. Backend queries must filter all workspace unit reads by organisation, including validation, and must never expose another tenant's custom unit in global resource options.
- **Deployment:** Database backup → verify current `units_of_measure` DDL in staging → apply migration → backend API patch → frontend patch → build with npm → test built assets through Apache with the owner's corrected `.htaccess`. Test product unit required, service unit optional, service variable pricing, tax default, create/select custom unit, duplicate and cross-tenant access, existing catalogues/invoices, light/dark/mobile/keyboard and errors. Do not enable production NRS or ERP flags as part of this work.

### Workspace control and dense table sizing (2026-11-07, UI/UX Batch 3)

- **Workspace default:** `TextField`, `Select` and `DatePicker` use `--control-h` (42px) and `--field-text-size` (`--text-sm`). `Button size="md"` matches that height. Avoid `size="sm"` for a form control adjacent to a DatePicker or other standard field; use it only in compact places such as pagination. The `Dashboard` and shared `ReportFilters` use default-sized controls and submit buttons so their rows align consistently.
- **Authentication exception:** `AuthLayout` and the separate `MfaEnrollment` screen override `--control-h` to `--control-h-lg` (50px), and `--field-text-size` to `--text-md`. Never change the shared workspace defaults merely to style an auth screen. MFA digit inputs are purpose-built and are not standard form controls.
- **Scrollbars:** Global 6px WebKit scrollbar and Firefox `thin`; retain the 6px custom styling on Select menu lists and drawer scroll regions. Always check both dark/light tracks against their surfaces.
- **Tables:** Desktop `DataTable` reserves at least 198px for a row-actions column and prevents buttons from stacking; dense/wide tables can scroll horizontally. Default primitive values render with ellipsis and `title`; custom compound cells must provide their own truncation/tooltip as done in Tax Rates. On mobile, action buttons may wrap within cards. Avoid `word-break: break-all` on identifiers or money amounts.
- **Header:** Breadcrumb trail and current screen heading are vertically stacked; the sticky topbar's light-mode surface stays near-white with a restrained shadow. Preserve its mobile breakpoints and dark-mode token values.
- **Percentages:** Tax Rates display two decimals only; do not round the values sent back to the backend or narrow its four-decimal input validation without a separate approved contract change.

### UI/UX Batch 4 — unified cards (2026-11-07)

- Workspace **card surfaces** use `background: var(--card-fill)` rather than `var(--color-surface)` when they are bordered, self-contained panels, summary cards, filters or tables. Interactive cards use `--card-fill-hover` when appropriate. Define the light and dark blends **only in `src/styles/tokens.css`**; never append screen-specific global overrides. In light mode the fill is almost white with a cool lower-edge tint; dark mode uses a soft slate/navy tonal shift.
- Keep document sheets and PDFs paper-white, and retain branded navy/band sections, field controls, badges and overlays on their purpose-specific surfaces. Those are not generic cards. The existing color-coded KPI icons/accents remain in place, with subdued backgrounds.
- Reuse `src/components/data/SummaryStat.jsx` for a **simple icon + label + value (+ optional note)** metric without recreating layouts in each page. Pass an explicit relevant `lucide-react` icon when available; it is decorative (`aria-hidden`) and must not replace the label. Use `StatCard` for the existing dashboard/report card presentation. Avoid adding icons just for decoration to every form row or data-table cell.
- Detail summary icons are visually contained within the existing `.metric` cards, without altering the label/value/badge reading order. Keep dense data, amount, invoice number and compliance status text visible on mobile and in dark mode.
- Regression: run `node --test tests/cardGradientConsistency.batch4.test.mjs` and the earlier UX tests. Source/parser checks do not substitute for `npm install && npm run build` or interactive browser visual tests in both themes. Verify the built app under Apache with the owner's corrected `.htaccess` and existing PDF CSP allowances.

### UI/UX Batch 5 — register cards and loader surface (2026-11-07)

- Register KPI grids (Customers, Catalogue, Invoices, Payments, Credit Notes, Proformas, Delivery Notes) render `SummaryStat`. Keep each page's existing `.stats` grid columns/breakpoints; **do not reintroduce** page-local `.stat`, `.statIcon` or `.statBody` decoration. All KPI cards inherit `--card-fill`, the theme's subtle gradient, semantic icon tone and shared shadows.
- `PageLoader` has a single centered `.panel` enclosing the spinner, loading text and progress bar. Full-screen loader fills the viewport with the theme background; inline route suspense keeps the app chrome visible and centers that same panel within its container. Respect `prefers-reduced-motion`.
- Local QA: verify Customers/Catalogue/Invoice/Payment/Credit Note/Proforma/Delivery Note KPI layouts at desktop and 390px, both themes; confirm the loader card is centered in global loading and lazy navigation, without obstructed text, unexpected scroll or changes to CSP.

### Onboarding sign-out and resume (Task 2, 2026-11-14)
`src/components/auth/SignOutAction.jsx` is the shared header sign-out control on onboarding and subscription pages. Unsaved steps trigger the existing `ConfirmDialog` before logout; completed updates remain in the existing PHP endpoints. `src/utils/onboardingResume.js` selects the backend's `next_step`, with fallback for an older API. Bank details are optional, but partially entered details must be validated/saved before continuing. On password, Google or MFA login, `resolveAuthenticatedStartPath` still enforces verification, MFA, subscription, onboarding and platform routing. An already-started but unverified Paystack checkout resumes at the plans page; Task 3 will implement safe pending checkout continuation.

Test: `node --test tests/onboarding_resume.test.mjs` and `npm run build` locally. Recheck the sign-out dialog, form persistence, welcome-back notice, light/dark mode and responsive widths.


### 2026-11-14 — Task 3 deployment dependency

Apply backend `migrations/20261114_subscription_checkout_recovery.sql` **before** uploading the checkout routes or the updated React plans page. Run `tests/subscription_pending_checkout_task3_unit.php`; see `docs/SUBSCRIPTION-PAYMENTS-TASK3.md` for operational rules, cron configuration and acceptance tests. Existing Paystack credentials, webhook signature checks and subscription activation rules remain authoritative.

### 2026-11-14 — Checkout exception UI

The Platform Subscriptions screen now calls the billing-permission-protected `POST /platform/subscriptions/pending-payments/close` and `/review` endpoints. Apply the backend payment-review migration first; then build this frontend with `npm run build`. Confirm dark/light and mobile layouts, review notes and credit previews with test payments. No new npm packages are required.
