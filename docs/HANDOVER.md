# DigitalInvoice NG — Updated Frontend Development Handover

**Updated:** 19 October 2026  
**Current milestone:** Invoice List implemented; **Invoice Creation / Editing is next**, followed by Invoice Details.  
**Purpose:** Continue development in a new chat without restarting, losing functionality, or undoing approved UI refinements.

> **IMPORTANT — Read this first.** This file summarizes work carried out in the preceding development conversation and the supplied handover/build-guide materials. It is not evidence that every change has already been merged into the user's latest local checkout. **The actual current frontend ZIP uploaded in the new chat is the source of truth.** Inspect it and reconcile any missing changes before beginning new work.

---

## 1. Files to provide in the new chat

1. **Current / new frontend codebase ZIP**, including the most recently applied screens and fixes. Exclude `node_modules/`, `dist/`, `.env`, credentials and private keys.
2. **Old frontend codebase ZIP**, strictly for functional reference. Do not copy its appearance or component implementations.
3. **This handover file**. Also retain/read the current project's `AGENTS.md`, `docs/BUILD-GUIDE.md`, `docs/HANDOVER.md` (if present), `design/README.md`, and relevant approved screenshots in `design/` and `design/screens/`.
4. If recent improvements have **not** yet been merged into the current ZIP, supply the missing changed-files patches or a current ZIP with them applied. In particular, verify the latest Select, sidebar, catalogue Unit of Measure, drawer-scrollbar and DatePicker fixes.

Do **not** assume a historical uploaded `frontend-cont.zip` or other older archive already contains every subsequent incremental update. The user has consistently requested **only added/modified files**, so earlier delivery ZIPs may represent separate patches.

## 2. Project and non-negotiable architecture

- **Application:** DigitalInvoice NG, a **complete UI/UX redesign**, not a cosmetic restyle of the old app.
- **Runtime:** Vite + React 18 SPA, React Router 7, Zustand; static deployment to cPanel/Apache at `app.digitalinvoice.ng` (no Node.js process in production).
- **Backend:** Existing PHP API, using carried-over services and session/CSRF handling. Keep payloads, endpoints, business logic and permissions intact.
- **Design system:** Approved **B2 Corporate** direction; Sora for headings/large figures, Inter for body/UI text; `num` class for figures/codes; `lucide-react` icons; colour variables from `src/styles/tokens.css`.
- **Themes:** Light is default; all pages must work in light **and** dark. Dark palette should be calm and legible rather than overly saturated.
- **Forms:** React Hook Form/Yup where existing; wrapped `react-select` / `react-datepicker` components and shared inputs. Form errors first appear on submit, then update as inputs are corrected.
- **Motion:** Shared CSS system in `src/styles/motion.css` (`fx-enter`, `fx-stagger`, `fx-pop`, `fx-shake`, `fx-shimmer`), generally transform/opacity only; respect `prefers-reduced-motion`. **Do not bring back framer-motion/AOS without approval.**
- **Documents:** Reuse `src/components/documents` (single document model for screen and PDF). Do not create competing invoice document or PDF templates.

**Always read `AGENTS.md` and the latest `docs/BUILD-GUIDE.md` before editing.** Do not change `src/services`, `src/utils`, `src/hooks`, `src/config`, or the auth/app/toast stores unless the task genuinely requires a business/API change and the user has approved it. Preserve all routes, guards, entitlements, permissions, and redirects in `src/app/routes.jsx`.

**Old frontend reference:** Use only for exact fields, labels, helper text, validations, API calls and payloads, messages/toasts, permissions, plan features, and navigation/workflow rules. **Never** copy its JSX markup, CSS, class names, layout, icons, animations, or visual design.

## 3. Implementation status at handover

| Area | Status and approved direction | Notes |
|---|---|---|
| Foundation and design system | Implemented | Tokens, fonts, theme, routing/guards, stores/services, motion, branding, cPanel assets. |
| Public and authentication flows | Implemented | Landing **Concept B**; Login; Register **Concept A**; Request Demo; Forgot/Reset; Check/Verify Email; invitation acceptance; subscription, payment verification, onboarding, customer portal, document/PDF system, system pages (per prior handover). |
| App shell | Implemented — **Sample B Inset** | Sidebar, desktop collapsed rail, navigation, search, notifications, profile, themes, responsive mobile tabs, platform shell. |
| Customers list | Implemented — **Sample A Classic Table** | `/app/customers`; filters, KPI cards, DataTable/mobile cards, pagination, CSV current-page export, add/edit/archive drawer. |
| Customer details | Implemented | `/app/customers/:id`; summary, compliance, contact, billing address, record details, edit/archive/create-invoice actions. |
| Products & Services list | Implemented using Customers patterns | `/app/catalogue`; list/table/mobile cards, summary cards, filter chips, pagination, add/edit/archive. |
| Product/Service details | Implemented | `/app/catalogue/:id`; pricing, tax, mappings, status, permitted actions. |
| **Invoice List** | **Most recently implemented** | `/app/invoices`; five metrics, filters/date range, table/mobile cards, pagination, archive controls. |
| **Invoice Create / Edit** | **NOT yet implemented in this conversation** | `/app/invoices/new`, `/app/invoices/:id/edit` were placeholders at the most recent Invoice List delivery. **Immediate next stage.** |
| **Invoice Details** | **NOT yet implemented in this conversation** | `/app/invoices/:id` was a placeholder at Invoice List delivery. Work on this after creation/editing. |
| Other app modules | Follow latest build guide | Proformas, delivery notes, credit notes, payments, reporting, settings/admin and other app pages as scheduled. Do not assume placeholders are implemented. |

**Status qualification:** “Implemented” above refers to delivered source patches and/or prior handover claims; a complete Vite production build and authenticated PHP API integration tests **have repeatedly remained unverified** in the prior environment because npm/Vite dependencies could not be installed. Verify implementation and tests from the freshly supplied current codebase; do not report unrun tests as passed.

## 4. Reusable component inventory

Reuse these before writing new components:

- `src/components/ui/`: Button, StatusBadge, Spinner, Skeleton, ThemeToggle, PageLoader, Toaster, Alert, etc.
- `src/components/forms/`: TextField, PasswordField, PasswordStrength, Select, DatePicker, Textarea, Switch, Checkbox, etc.
- `src/components/data/`: **DataTable**, **FilterBar**, **Pagination** (responsive card rendering, loading/empty states, URL-synced filters, server-side pagination).
- `src/components/overlays/`: **Drawer**, Modal, ConfirmDialog; focus/keyboard/scroll behaviour.
- `src/components/shell/` and `src/app/layouts/`: shared AppShell/PlatformShell, GlobalSearch, navigation, PageHeader.
- `src/components/documents/`: shared invoice/document renderer and PDF model(s).

Specific implementation names and props must be checked against **the actual current source**, not inferred from this inventory.

## 5. Approved UI patterns — DO NOT REGRESS

### A. Sidebar / workspace / main canvas

- Sidebar uses the **layered navy-to-blue / restrained teal gradient** inspired by the right-hand authentication brand panel, with subtle glow/pattern effects. Sidebar colours should remain **the same in light and dark mode**.
- Navigation active states use the refined inset background and clear accent, without excessive glow. Preserve permission- and entitlement-filtered menus and collapsed fly-outs.
- Logo with slogan remains visible and modestly sized; maintain generous spacing from the logo to the first “WORKSPACE” section heading.
- **Current Workspace** belongs **beneath the scrollable menu**, near the sidebar bottom and above Collapse Menu. Show **company name only** plus a small **green status dot if active**. Vertically center items; truncate a long name with ellipsis; show full organisation name and status via mouse-hover and keyboard-accessible tooltip. Do **not** reinstate the large avatar or an “Active” text pill.
- The large inset content canvas has **no outer border** and uses a **subtle token-derived gradient** in both themes. Individual controls and cards retain appropriate borders/focus rings. Customers View (eye) row action is borderless.

### B. Cards and panels

- Customer summary cards use subtle individual accents, gradients, refined icon backgrounds, borders and shadows. Keep this visual language for Products and Invoices.
- Customer Details identity/profile hero and its compliance, primary-contact, billing-address, and record-summary cards use the more refined, restrained gradient treatment in both themes. Never make cards look garish or flat.
- Auth layouts retain generous **uniform padding** around the right panel, ample **logo-to-content space**, motion, and floating invoice/payment graphics. The wider form side and approved login/registration/password layouts should remain intact.

### C. Forms, selects, date pickers and validation

- Search, text-input, Select and DatePicker controls are approximately **42px high** by default. Large controls may use the documented larger token where appropriate; do not mix field heights within a row.
- **Latest DatePicker styling patch:** `src/components/forms/DatePicker.module.css` changed height **50px → 42px**, input font **15px → 13px**, weight **400**, calendar icon about **16px**. Preserve keyboard/date-picker behaviour.
- App-wide Select dropdown option labels use compact (~**12px**) regular weight. Selected-option **checkmark is a separate icon at the far right on the same line**; it must **never wrap beneath the label or touch the text**. Preserve `react-select` accessibility and menu portal behaviour.
- Pagination rows-per-page control uses the **shared Select component** (not a native HTML `<select>`), with existing 10/20/50 values.
- Search gets balanced width beside full-length select filters; on narrow screens, fields stack rather than squeeze labels.
- Form validation error messages must appear beneath the affected control **without vertically misaligning side-by-side controls**; use appropriate grid alignment and `min-width: 0`/input containment.
- **Products Unit of Measure fix:** The item form should load reference units **independently** of tax/FIRS data; valid unit records should not be wiped out because their category scheme differs or another request fails. If API truly returns no units, show a meaningful empty/error message with **Retry** preserving entered form data. Do not invent unit IDs or hard-code unverified choices.

### D. Buttons / drawers / overlays

- Buttons: slightly smaller font and **lighter weight**, primary filled button text **white in both themes**, subtle blue gradients/light sweep where established, gentle lift, restrained shadows, readable secondary/Google button contrast. Ensure plus/action icons inherit legible colour.
- Drawers have restrained gradient header/body/footer, **compact labels/input text**, sticky/usable footer where appropriate, and a **thin internal scrollbar** (distinct from main page scrollbar). Maintain accessible focus trap, Esc, outside click, and scroll locking as implemented.
- Use existing ConfirmDialog, loading/empty states, StatusBadge, toast messages. Maintain keyboard access and reduced-motion support.

## 6. Modules implemented — functional details to preserve

### Customers (`/app/customers`, `/app/customers/:id`)

- Approved Sample A Classic Table. `customerService.list({ search, type, status, page, limit })`; debounced search **360ms**; URL filters and pagination; active status default; limit 10; mobile cards; 3 summary metrics.
- Add/Edit Customer retains original fields, validation, permission gating (`customers.manage`), service calls, toasts; archive uses the original confirmation. View/Edit/Archive actions and customer detail actions must remain functional.
- **Export is intentionally current-page CSV only** (`customers-page-N.csv`), not a full database export: no bulk-export API was established.
- Customer Details retains compliance, primary contact, address, notes, skeleton/error/retry, and permission-gated Edit/Archive/Create Invoice links.

### Products & Services (`/app/catalogue`, `/app/catalogue/:id`)

- Uses shared DataTable, FilterBar, Pagination, Select and Drawer; URL-synced search/type/status/page; summary cards; mobile item cards; existing `itemService` and validators.
- Add/Edit Item includes **all pre-existing product/service fields** (pricing, unit of measure, currency, tax/FIRS mappings, availability and other original fields), permission checks and toasts. Do not drop rarely used fields merely because they are below the visible fold.
- Preserve the independent Unit of Measure/reference-data loading and two-column error alignment fix described above.
- Item Details includes pricing, tax, compliance, record information and permitted actions.

### Invoice List (`/app/invoices`)

- Delivered source files include:
  - `src/pages/invoices/Invoices.jsx`
  - `src/pages/invoices/Invoices.module.css`
  - `src/pages/invoices/invoiceListOptions.js`
  - relevant `src/app/routes.jsx`, design previews and build-guide updates.
- Reuses existing `invoiceService.list`, `invoiceService.archive`, collection/status/permission helpers. Search/status/FIRS/date-from/date-to/page/limit sync to URL. Server-side page sizes: 10/20/50.
- Five summary metrics distinguish dataset total from current-page amounts. If monetary totals span incompatible currencies, display **“Mixed currencies”** instead of summing them.
- Edit/archive are restricted to permitted users and the appropriate editable draft/returned statuses. New Invoice action requires `invoices.create`.
- Latest DatePicker fix applies to From date / To date fields.
- Existing list implementation was source-checked, but **live backend smoke tests and complete Vite build are still pending**.

## 7. Immediate next task: Invoice Creation and Editing

**DO NOT rebuild the Invoice List** merely to start this task. Inspect it for navigation and component conventions, then implement the pre-existing create/edit routes while preserving the original invoice workflow.

**First inspect these references in the old frontend** (file names based on the previously uploaded old app; confirm in the new upload):

- `src/pages/invoices/CreateInvoice.jsx`
- `src/pages/invoices/InvoiceDetails.jsx`
- `src/pages/invoices/Invoices.jsx`
- `src/components/invoices/InvoiceLineEditor.jsx`
- `src/components/invoices/invoiceOptions.js`
- `src/services/invoiceService.js`
- `src/utils/invoiceCalculationPreview.js`
- Related customer, product, tax, currency, approval, payment, and document helpers where called.

**Also inspect the current frontend's** `src/app/routes.jsx`, existing `src/services/invoiceService.js`, shared form controls, and `src/components/documents` before coding.

Verify against the old functionality/API, rather than guessing:

- customer/product selection and relevant query-string defaults (e.g. `?customer=ID` if supported);
- invoice number/type, dates, due dates, currency, notes and payment terms;
- line items, quantity, unit, descriptions, unit prices, discounts, tax treatment;
- exact calculation, rounding, tax and totals rules (using existing helpers); **avoid parallel calculation implementations**;
- save-draft, edit eligibility, errors, redirects, status transitions and permission/entitlement checks;
- invoice preview/PDF and shared document system integration;
- API request bodies, service methods, loading, retry and error handling.

**Design workflow:** Check `design/` and `docs/BUILD-GUIDE.md` for an approved invoice form sample. If none exists, **show two genuinely distinct design samples in desktop light, desktop dark, and mobile before writing the form code**. Obtain user approval. Reuse all established Customers/Catalogue design patterns; avoid a new visual style.

After Create/Edit, implement **Invoice Details** using the existing workflow and shared document renderer, then resume the current build order (other sales documents, payments, reports, settings, platform admin, etc.).

## 8. Development process and delivery contract

1. **Inspect** the uploaded current source, old source, `AGENTS.md`, latest build guide and approved designs. Verify the last patch is merged; do not assume it.
2. **Inventory** the exact page/route, existing services, validations, permissions, known reusable components and outstanding QA before coding.
3. **Present designs** (two options, desktop light/dark/mobile) if no approved sample already exists; wait for approval. Otherwise use the approved sample directly.
4. **Implement narrowly**, reusing components; avoid changing carried-over services/stores or completed screen logic. Keep routes and guards unchanged except replacing necessary placeholders.
5. **Validate honestly:** run `npm ci`/`npm install` as appropriate and `npm run build` if dependencies are available; inspect browser at 390/768/1024/1440, light/dark, loading/error/empty, reduced motion, keyboard/focus and API with permission variations. Check calculation tests and PDF where applicable. Do not invent passing tests.
6. **Deliver ONLY changed or added files**, in a ZIP preserving their exact project-relative paths, **never the full codebase**. Include docs (`docs/BUILD-GUIDE.md`, `design/README.md`, `design/screens/`) when updated. Clearly report build/API test limitations; previews using representative data must be labelled as illustrative.
7. If a change affects a shared component (Button, Select, Pagination, DatePicker, Drawer, AppShell), verify it doesn't break Customers, Products, auth screens, or Invoice List.

**Historical environment warning:** The previous workspace frequently lacked installable npm/Vite dependencies. Static parsing and CSS-only/browser previews are **not** equivalent to a full running React build or authenticated API test. Run the real checks wherever possible in the next environment.

---

## 9. Ready-to-paste instruction for a new chat

> I am continuing **DigitalInvoice NG**, not starting a new project. I have attached the **latest current React/Vite frontend**, the **old React frontend for behaviour/API reference only**, and this updated handover.
>
> **Read `AGENTS.md`, `docs/BUILD-GUIDE.md`, `docs/HANDOVER.md` (if available), `design/README.md`, and the approved screenshots first.** Inspect the latest current source and determine which incremental changes are actually merged; do not assume the older archive includes later patches.
>
> The new frontend is React 18 + Vite + React Router 7 + Zustand, deployed statically to cPanel and calling an existing PHP API. It is a **complete B2 Corporate UI redesign**, so preserve the old application's copy, API/payloads, validation, permission/entitlement rules and workflows but **never copy old layouts/CSS/markup/components**.
>
> The public/auth screens, App Shell Sample B, Customers Sample A and Customer Details, Products & Services List/Details, and **Invoice List** have been developed (full authenticated QA may remain pending). Our many shared UI refinements—including navy gradient sidebar, compact workspace dock, aligned 42px controls, repaired Select checkmark, thin drawer scrollbar, independent Unit of Measure loading, subtle card gradients and refined button typography—must remain intact.
>
> **Next work: Invoice Creation and Editing**, then Invoice Details. Review the old `src/pages/invoices/CreateInvoice.jsx`, `InvoiceDetails.jsx`, `src/components/invoices/InvoiceLineEditor.jsx`, `src/services/invoiceService.js`, `src/utils/invoiceCalculationPreview.js`, and the current app's services/routes/document system. Preserve existing calculations, statuses, API payloads, guards and PDF/document models. The Invoice List exists: don't rebuild it.
>
> If there is no previously approved invoice form design, first show **two design directions** in desktop light, desktop dark and mobile and wait for me to select one. Then implement, validate and deliver **ONLY added/modified files** in a ZIP with paths preserved, plus updated documentation and clearly labelled screenshots. Never claim a build or live API test passed unless it actually did.

---

**Final reminder:** When handover prose disagrees with the actual uploaded current source, inspect the implementation and ask about material inconsistencies rather than silently rewriting features. The user's design approvals and existing API/business behaviour must be preserved.


- Font: **Sora everywhere** via `var(--font-sans)`; keep both `'Sora'` @font-face rules in `src/styles/fonts.css` with identical descriptors (otherwise the app silently falls back to Inter).
