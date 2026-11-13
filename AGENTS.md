# Agent instructions

This is the **new** DigitalInvoice NG frontend: a Vite + React single-page app deployed as static files to cPanel (no Node.js on the server), talking to the existing PHP API.

## This is a complete redesign
The UI/UX has been **completely redesigned**. The previous app (`old/` or whatever folder it's shared in) is a reference for **behaviour, wording and API usage only**:
- **Do** reuse from the old app: the copy (labels, headings, messages, toasts), the fields and validation rules, the API calls and payloads, redirects, permissions and feature flags.
- **Don't** copy from the old app: markup structure, CSS, class names, layouts, colours, fonts, icons (Font Awesome is gone), animation code (framer-motion/AOS are gone) or component implementations.
- Every screen must follow the new design system (`src/styles/tokens.css`, `design/`) and use the new components in `src/components`.

## Before changing anything
Read `docs/BUILD-GUIDE.md` (architecture, design system, components, motion, conventions, deployment, build order) and look at the images in `design/` (the approved direction and the built screens).

## Hard rules
- **Scroll locking:** use `lockPageScroll()` (`components/overlays/scrollLock.js`); never set `overflow` on `<body>` (it breaks the sticky sidebar). **Font sizes:** use `--text-*` tokens or `calc(Npx * var(--font-scale))`; buttons follow `--button-font-scale`.
- **Font: Sora everywhere.** Use `var(--font-sans)` (never name a font directly). In `src/styles/fonts.css` both `'Sora'` @font-face rules must keep identical descriptors (`font-weight: 100 800`, `font-style: normal`), or browsers skip Sora and render the whole app in Inter.
- Preserve `src/services`, `src/stores`, `src/utils`, `src/hooks` and `src/config` as business-logic modules, separate from JSX/CSS. **During the NRS Steps 1–4 port**, changes to these modules are expressly allowed to synchronize API behaviour with the verified old frontend and PHP backend; do not replace their behaviour with a redesign. Outside API-contract/behaviour work, leave them untouched. Keep visual components in `src/components` and screens in `src/pages`.
- Keep every route address, guard and permission in `src/app/routes.jsx`.
- Colours only from design tokens; no raw hex in components (except the documented brand-panel and logo cases).
- Light is the default theme; dark only when the user chooses it.
- Animate transform/opacity only, use the shared classes in `src/styles/motion.css`, respect reduced motion.

## NRS frontend migration (started 2026-11-06)
- The redesigned frontend is the **only** deliverable; old frontend is a reference for logic/copy only, backend is **read-only** during frontend work.
- `PORTING-INVENTORY.md` is the migration checklist. Step 0 synchronized service/store/util helpers and CSP. Auth phases 1a–1d are source-implemented (browser verification pending); Phase 2a is adding NRS fields/features to existing redesigned screens in approved batches.
- `docs/CHANGELOG.md` is **append-only**, with a dated section for each completed step; do not replace or truncate earlier entries.
- NRS IRN, CSID and QR are displayed only for verified **production** evidence from the backend with a verification timestamp and all identifiers. Otherwise say **“Not yet submitted to NRS”**. Sandbox/queue is a dry run; there is no licensed/live NRS submission.
