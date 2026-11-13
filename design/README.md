# DigitalInvoice design reference

This app is a **complete redesign**. Nothing in these images comes from the previous app's design; use them, not the old screens, as the visual reference.

## Approved direction: B2 · Corporate (`direction-B2-corporate.png`)
- Teecoms navy and blue; navy sidebar in both themes; **light is the default theme**.
- **Sora everywhere** (headings, text, forms, tables). ₦ and Yoruba/Igbo dot-below letters come from a small Inter fallback inside the Sora font family.
- All text and button colours pass WCAG AA (4.5:1) in both themes.
- The board shows the target app shell, KPI cards, filters, table, statuses, pagination, an open Select (light) and an open DatePicker with presets (dark).

Exact values live in `src/styles/tokens.css`. The app now uses Sora everywhere (direction B1 typography), matching the reference app.

## Dark palette update
Dark mode was recalibrated toward the previous app's calmer slate tones (less saturated, slightly lifted). Values live in `src/styles/tokens.css`. Screenshots `login-dark.png`, `app-shell-dark.png` and `request-demo-select-dark.png` show the current palette; older dark screenshots were taken before this update, so where they differ, the tokens are the source of truth.

The logo always appears **with its slogan** ("Smart Invoicing, Seamless Compliance"): `Logo variant="full"`, at least 32px high (36–40px in headers and the sidebar). Only the collapsed rail and the loader use the icon.

## Approved sample boards
These are the design samples you chose, one per screen or section. Build to them.

| File | Approved for |
|---|---|
| `direction-B2-corporate.png` | Overall design direction (colours, fonts, components) |
| `login-sample-A.png` | Auth screens: split layout with animated navy brand panel |
| `request-demo-sample-A.png` | Request demo: hero continuation of the Landing page |
| `plans-sample-B.png` | Subscription plans: navy band with overlapping plan cards |
| `onboarding-sample-B.png` | Onboarding: top stepper + centred form card |
| `portal-sample-B.png` | Customer portal: summary card + modern document template |
| **`app-shell-sample-B.png`** | App shell: floating navy sidebar, rounded content sheet, icon rail with group fly-outs when collapsed, mobile bottom tab bar |
| **`customers-sample-A.png`** | **Customers list (approved):** classic table, three stats, search/filters, pagination, add customer drawer, mobile row cards |

## Built screens (`screens/`)
| File | Shows |
|---|---|
| `login-light.png`, `login-dark.png` | Login (approved Sample A): form left, animated navy brand panel right |
| `login-mobile-light.png`, `login-mobile-dark.png` | Login on a 390px phone: brand panel hidden, compact logo header |
| `login-errors-light.png` | Inline validation after submit |
| `login-session-expired-light.png` | Session-expired alert above the form |
| `loader-light.png`, `loader-dark.png` | Full-screen centred loader |

| `register-light.png`, `register-dark.png` | Register (Concept A, seamless split) with password strength |
| `forgot-password-light.png`, `reset-password-light.png` | Account recovery |
| `check-email-light.png`, `verify-email-error-light.png` | Email confirmation and a failed verification state |
| `accept-invitation-team-dark.png` | Team invitation |
| `accept-invitation-platform-light.png`, `accept-invitation-platform-mobile.png` | Platform invitation with the invitation summary |
| `request-demo-select-light.png`, `request-demo-datepicker-dark.png`, `request-demo-select-dark.png`, `request-demo-mobile-light.png` | Request demo (Sample A, hero continuation) showing the Select and DatePicker components |
| `plans-light.png`, `plans-manage-dark.png`, `plans-mobile-light.png` | Subscription plans (Sample B, navy band): choose mode, manage mode with the current subscription |
| `plans-premium-request-dark.png`, `plans-cancel-renewal-dark.png` | Premium request modal and the cancel-renewal confirmation (Modal, ConfirmDialog) |
| `verify-payment-success-light.png`, `verify-payment-error-light.png` | Paystack return page: confirmed and not confirmed |
| `onboarding-business-light.png`, `onboarding-compliance-dark.png`, `onboarding-review-dark.png`, `onboarding-mobile-light.png` | Workspace setup (Sample B, top stepper): business profile, compliance with Switch + Checkbox, final review, mobile |
| `portal-invoice-light.png`, `portal-credit-note-dark.png`, `portal-delivery-note-dark.png`, `portal-mobile-light.png`, `portal-link-unavailable-light.png` | Customer portal (Sample B: summary card + modern document) for different document types |
| `pdf-invoice-sample.png`, `pdf-receipt-sample.png` | Generated PDFs (modern template, embedded Inter/Sora fonts) |
| `app-shell-light.png`, `app-shell-dark.png`, `app-shell-mobile-light.png` | App shell (Sample B, inset) with the calmer dark palette and the logo with slogan |
| `not-found-light.png`, `access-restricted-dark.png`, `access-restricted-mobile-light.png` | System pages (StatusPage) |
| `landing-light.png`, `landing-dark.png` | Public landing page (Concept B, immersive corporate) |

New screens should match these: same spacing, field style, button style, type scale and motion.


## App shell, approved Sample B

`app-shell-sample-B.png` remains the approved reference. The step-2 React shell has been implemented in source. CSS-only visual layout QA previews are stored as `screens/app-shell-layout-light.png`, `screens/app-shell-layout-dark.png` and `screens/app-shell-layout-mobile.png`. These previews demonstrate layout dimensions and styling but **are not screenshots of a fully built/authenticated React app**. Full Vite build and API-integration testing are still pending.


## Customers list (approved Sample A)

The Customers list at `/app/customers` uses the approved `customers-sample-A.png`. Layout previews `screens/customers-light.png`, `screens/customers-dark.png`, `screens/customers-mobile.png` and `screens/customers-drawer-dark.png` are illustrative/static (representative fictitious records, not an authenticated API test).

**October 2026 shell refinements:** the approved inset navigation uses the same navy sidebar in light and dark themes, a slightly smaller full logo, and a workspace status dock below the menu. The main content sheet has no outer border. Customer filters and pagination use the shared Select component with compact options.

## Catalogue (Products & Services)

`src/pages/catalogue/` uses the approved **Customers Sample A** structure: subtle four-metric cards, classic responsive table, balanced filters, pages, and a refined add/edit drawer. Item details reuse the upgraded Customer Details card language. Visual references: `screens/catalogue-light.png`, `screens/catalogue-dark.png`, `screens/catalogue-mobile.png`, `screens/catalogue-drawer-dark.png`. These are static representative-data layout previews, not authenticated application screenshots.

- Invoice List (`/app/invoices`) continues Customers Sample A, with invoice workflow statuses, finance KPIs, desktop table and mobile cards. Screens: `screens/invoices-light.png`, `screens/invoices-dark.png`, `screens/invoices-mobile.png` (static layout previews).

## Invoice creation/editing (approved Concept A)

`design/screens/invoice-editor-approved-concept-a.png` is the approved illustrative reference (desktop light/dark, mobile); it is **not** a browser screenshot of the implemented React page. The implemented screen reuses the existing Customer and Catalogue drawers; the new Payment Account drawer follows the same shared Drawer and form styles.


## Phase 2b: Invoice Details (7 Nov 2026)

`/app/invoices/:id` follows the completed **Customer Details card hierarchy**, **Invoice Editor panels**, and existing **approved DocumentSheet paper design**. The source-implemented page has a compact reference/status hero, workflow actions, financial snapshot cards, stored line-item classification table, local UBL and dry-run queue panels, a fitted document preview and history/payment cards. PDF and print use the existing paper template; the preview is not a separate design. Reuse the same token-based cards and subdued icons in both themes, and stack cards on mobile.

This is an implementation note, **not** a new approved screenshot or a claim of browser visual QA. Compare against the approved `customers-sample-A.png`, invoice-editor concept and customer portal design; visually review light, dark, mobile, long line names, QR status and every modal after the local Vite build.


## Phase 2b: Credit Note Details (7 Nov 2026)

`/app/credit-notes/:id` follows the same redesigned card hierarchy as Invoice Details, with a credit-note icon, source-invoice financial context, reason and credited lines, offline UBL inspection and shared modern paper document output. No older frontend layout or stylesheet is reused. The customer-facing actions remain disabled until approval, while the NRS evidence panel shows only qualified production evidence.

This is a **source implementation note, not a browser-validated screenshot or separate approved design**. Review long credit reasons, line descriptions and PDF output using the approved Customer Details, Invoice Editor and Customer Portal references; verify light/dark themes and mobile after the local build.


## Phase 2b: Credit Notes list and editor (7 Nov 2026)

The credit-note register follows the approved **Customers Sample A** layout and the existing Invoice list: five quiet summary metrics, search/status/date controls, a clean table with desktop icon actions and responsive mobile cards. Create/edit follows the **approved Invoice Editor Concept A** with its breadcrumb, PageHeader, grouped form panels, invoice-line selection cards and sticky credit-impact summary. All visible styles use the new frontend's Sora, design tokens and shared controls; no old frontend layouts, icons or animation implementations are ported.

This is a source implementation reference, **not** a browser-validated or separately approved screenshot. QA should cover long invoice references and reasons, the async approved-invoice dropdown, credit quantities/errors, mixed currencies on the register, light/dark themes, 390px mobile and keyboard navigation.


## Phase 2b: Proforma Invoices (7 Nov 2026)

The proforma register uses the approved **Customers Sample A** / Invoice list layout (five quiet metrics, Filters, responsive desktop table and mobile row cards). The form uses the approved **Invoice Editor Concept A** (client selector, quick-add drawers, line cards, right-hand sticky estimate) without copying the legacy proforma page. Details reuse Invoice Details cards and the shared DocumentSheet/PDF design. Styles inherit Sora, semantic tokens, existing buttons and motion rules; both light and dark themes and mobile breakpoints come from shared components.

This is a source-built implementation note, **not** a browser screenshot or separate approved redesign. Manually review the empty list, long customer names, issued/draft status, issue confirmation dialog, discount errors, document zoom, modal portal menus and 390px mobile on the compiled app. Proformas are not tax invoices and do not display NRS evidence.


## Phase 2b: Delivery Notes and navigation visibility (7 Nov 2026)

Delivery Notes use the approved Customers Sample A register layout, Invoice Editor Concept A form hierarchy and Invoice Details / Customer Portal paper output. The source-invoice line cards show ordered, previously delivered and remaining quantities (including partial deliveries), with a sticky dispatch summary that does not invent invoice amounts. Shared Sora, design tokens, field sizes, status badges and CSS motion remain intact in light and dark modes.

The workspace's Sales group opens by default in the expanded sidebar so users can discover the newly implemented Credit Notes and Proforma Invoices links. On mobile, the Sales bottom tab opens a dedicated menu of permitted Sales destinations; the More sheet and collapsed icon-rail fly-outs retain the approved shell design. A missing menu item may still correctly reflect permissions/plan entitlements. These are source-based changes, **not** a browser screenshot or new approved design. Visually QA compact mobile menu, long labels, 390px layout, fields and print/PDF under Apache CSP.


## Phase 2b: Payments register and receipt details (7 Nov 2026)

Payments follow the approved **Customers Sample A** responsive register, sharing the Invoices filters, KPI tiles, DataTable/mobile cards and status/amount typography. The record/allocate/email/void dialogs reuse the established Modal, TextField, Select, DatePicker, Textarea, Alert and Button components. Receipt Details follows Invoice Details' quiet hero, three financial summary cards, two-column information cards and approved shared paper preview/print/PDF. All supplemental styles use semantic tokens and Sora in light/dark themes. No legacy frontend design is copied.

This is a source implementation note, not a browser-validated visual screenshot. Visually review 390px mobile, long receipt IDs/customer names, mixed currencies (never summed as one amount), customer async search, payment invoice picker, irreversible void warnings, modal keyboard navigation and print/PDF under Apache CSP. The shared NRS evidence gate remains production-verified only.


## Phase 2b: Customer Portal Links Management (7 Nov 2026)

`/app/customer-portal` follows the approved **Customers Sample A** / Invoices register visual language: five restrained metrics, a consistent filter strip, responsive table and mobile cards, small status badges, and a standard confirmation dialog for revocation. Source-document links use the existing app navigation, while the private customer URL is never re-created from a historical list item. The layout uses the existing page spacing, Sora scale and semantic light/dark tokens; no old frontend styles or markup were copied.

This note describes source implementation, **not** a browser-verified screenshot or separately approved design. Manually review 390px mobile with long titles/emails, all status badges, active/expired/revoked filter results, 80-link cap note, keyboard focus in the revoke dialog, and the expanded/collapsed Sales navigation under both themes after local build.


## Phase 2b / batch 8 — Dashboard visual implementation (7 Nov 2026)

The workspace Dashboard follows **Customers Sample A**'s quiet metrics, restrained white/dark cards, Sora text hierarchy, token-only accents and the approved inset app shell. Period and currency filters use the shared Select/DatePicker/Button controls. Six KPI cards, four understated operational insights, a lazy-load line/area chart and two responsive recent-record lists are deliberately grouped for legibility at 390/768/1024/1440px. The compliance note remains visibly separate from operational KPIs; no NRS-submitted claims. This is a source-level implementation reference, **not a screenshot nor a browser-verified visual**. Check both themes, mobile column collapse, long money/recipient strings, accessible trend table, loading/error/empty states and keyboard navigation against the built app served with Apache CSP.

## Phase 2b / batch 9 — Reports (7 November 2026)

The Reports hub uses six softly separated, fully clickable cards with compact lucide icons and restrained hover states. The report pages borrow Customers Sample A's responsive registers and the Dashboard's quiet StatCard KPIs, grouped filter panel and semantic empty/error messages. The Customer Statement includes a navy-toned account summary (using `--color-band`) and an accessible transaction table; its PDF uses the redesigned document Sora/Inter fonts and a simple branded header instead of copying the legacy statement design. Compliance Readiness uses simple profile checks and neutral status panels: **never badge an organisation as NRS certified**. All colors are design tokens in both themes. On narrow screens, filters stack and tables switch to existing mobile cards.

This is **source-implemented**, not an approved browser screenshot. Visually QA 390px/768px widths, long organisation/customer names, summary card wrapping, wide date/currency forms, mobile menu's Reports links, report table scrolling, keyboard focus, PDF font rendering, empty/error states and live light/dark interactions. Validate statement PDF export/email with the compiled app served by Apache and the actual CSP; the dev server ignores `.htaccess`.


## Phase 2b / batch 10 — Workspace administration (2026-11-07)

Team Members, Tax Rates and Activity Log use the approved Customers Sample A register rhythm and the existing `PageHeader`, `DataTable`, `Select`, `TextField`, `DatePicker`, `Modal`, `ConfirmDialog`, `StatusBadge`, `Alert` and `Button` components. The shared admin-only CSS module uses design tokens, `--text-*` font sizes and no legacy icons/styles. Desktop tables collapse to the shared responsive mobile cards. Destructive role/status/invitation/tax-rate actions require the proper backend authority and confirmation where appropriate. Profile/MFA security will be built separately.


## Phase 2b: Workspace Profile and Security (7 Nov 2026)

`/app/profile` uses the approved settings visual language: `PageHeader`, quiet bordered surface panels, icon-led headings, two-column fields where appropriate, Sora type scale, tokenised actions and responsive one-column forms on mobile. The read-only identity section, profile edit, password form and MFA actions intentionally remain separate so risky security operations are never mistaken for basic account edits. MFA setup has a centered scannable QR, copyable setup key, six-box code input and one-time recovery-code panel with explicit acknowledgment. The QR alone uses fixed black-on-white for scanning; all other colours respond to light/dark mode.

This is a **source implementation**, not an authenticated browser screenshot or separate design approval. Review desktop/light/dark/390px mobile, keyboard and autofill, long identities and role labels, expired setup, invalid current password, manage/disable confirmations, recovery code overflow, file save and profile session revocation on the built Apache-served frontend. The platform profile remains a later screen and can reuse the MFA card rather than copy the old design.


## Phase 2b / batch 12 — Platform administration

Platform Dashboard, Clients, Client Details and Platform Users follow the approved B2 corporate direction: Sora, semantic token surfaces, existing shared fields/buttons, compact account-state badges, calm summary cards and table/mobile-card layouts. Destructive account/archive and role actions use confirmation affordances. Empty, loading, errors, access restrictions and long names should be verified at 390/768/1024/1440px in both themes. The backend's first-page client cap is labelled; no invented pagination or misleading mixed-currency totals. This work does not establish live NRS submission.

## Phase 2b / batch 13 — Platform billing (7 Nov 2026)

Plans, Subscriptions, Subscription Details and Premium Requests use the approved B2 corporate platform administration surfaces and Customers Sample A register conventions: understated summary cards, search/filter strip, responsive DataTable and mobile cards, shared form controls and accessible confirmation dialogs. The plan entitlement editor uses the existing Checkbox and Switch styles; manual payment entry stays visually separate from provider verification. New styles use only semantic light/dark tokens and Sora type scales. No old frontend CSS, icons or layouts were copied. Source implementation only; not a browser-validated screenshot. Check modal scroll and dropdown portals, mobile pricing/limits, long references and notes, dark mode, focus states and Apache CSP after local build.

## Phase 2b / batch 14 — Platform Revenue and Activity (7 Nov 2026)

The new Revenue and Activity pages extend the approved platform administration register style: quiet five/four-card summaries, existing field and table controls, Sora text scale, semantic tokens, clear action hierarchy and responsive mobile cards. Revenue's miniature bar graphics represent **counts**, never mixed-currency money, with readable numeric labels independent of width or colour. Activity logs use simple text hierarchy and no raw metadata surfaces. Both screens reuse the approved `PlatformAdmin` surfaces and light/dark mode treatment, with a small `PlatformInsights` CSS supplement. The backend's currency scope and limited actor/client selectors are explained in-page. These are source-level layout decisions, not browser-verified visual screenshots; manually review 390px mobile, date popovers, keyboard, long emails/refs, and content under both themes with the built Apache-served application.

## Phase 2b / batch 15 — Platform account screens

The platform Profile shares Workspace Profile's stacked identity/password/MFA panels and uses the existing security card instead of copying the old platform UI. Platform Settings uses the approved B2 inset platform shell, PageHeader, semantic cards, two-column settings groups (one column on tablet/mobile), existing TextField/Select/Switch/Button/Alert/ConfirmDialog controls, token-only colours and Sora typography. Read-only permission and unavailable-migration states remain visible and accessible. The same light-default/dark-optional, keyboard and 390px mobile standards apply. Settings environment labels communicate preferences, not production NRS evidence.

## Phase 2b / Batch 16 — NRS integration settings and modal Select portal (7 Nov 2026)

The Platform NRS/MBS Integration screen uses the approved B2 platform settings pattern: a quiet four-card readiness overview, two configuration/security panels, local resource cards, diagnostics and a token-styled resource drawer. Controls reuse shared components (Sora, existing line/hover/surface tokens, dark/light, 390px responsiveness). The recorded licence field is described as **internal** rather than official NRS verification; production submission is visibly locked. Previously stored keys are indicated by status, not shown or filled in.

The shared Select's dropdown uses a body portal above the Modal/Drawer overlay layer, with fixed positioning to avoid clipping and allow clicking options. The overlay's backdrop and focus trap remain intact. This is source-implemented, **not a browser screenshot**. Visually verify modal dropdown overlays from Payments, Team invitations, Plans and workspace forms, especially near the bottom of scrolling dialogs and mobile sheets, in both themes.


## Step 6 — ERP management screen (source implemented; visual QA pending)

The Administration → ERP Integrations screen follows the **Customers Sample A** register and the existing workspace settings panels: PageHeader, compact tab strip, responsive DataTable/mobile cards, token-based cards and modal forms. Secrets are shown once in a focused dialog, with clear copy/download controls and an acknowledgement. Verify light/dark/mobile and in-modal keyboard focus in the built app before considering these screens visually approved. This is an ERP synchronisation console, not an NRS licensing or live-submission screen.

### 2026-11-07 — Platform currency totals (Step 8)

The existing Platform Dashboard and Revenue panels now expose independent currency rows rather than withholding all revenue metrics. Use existing `DataTable`, `.entries` and `.panel` patterns with `num` for amounts and `ref` for currency codes; keep the filtered breakdown inside its parent register card. Preserve the approved Sora/tokens, mobile cards and light/dark appearances. Never combine money from different currencies or introduce a currency-conversion widget that would misrepresent recorded source amounts. No visual changes outside these two screens.

**Step 9 (2026-11-07):** Platform Clients, Client Details, Plans, Subscriptions and Subscription Details keep their existing admin register/panel structure. Per-currency totals use the shared platform KPI-card grid (Sora, design tokens, light/dark and mobile responsiveness); avoid a single total spanning currencies. No changes to approved reference layouts or visual tokens.
