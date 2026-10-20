# Review-gate ledger — ds-primitive-sweep (EX-1110) · 2026-10-20

Scope: `05b6d8911...fe7cb0673` (merge-base with `staging` → branch HEAD), 254 files.
Step 0.5 (browser verification) skipped — no browser pass without an explicit ask; manual checks live
in `context/foundation/manual-checks.md` § EX-1110.

Checks run: `10x-impl-review`, `code-review`, `tailwind-v4-audit`, `comment-noise-audit` (flag-only),
`feature-first-structure` + `module-cohesion-audit` + `structure-scatter-audit` (diff-scoped).

## Findings

- [x] 🔴 CRITICAL · fixed · code-review + impl-review F1 · `src/components/nav/mobile-nav.tsx:116` · „Manual Wykończymy" flashed and vanished on phones — the Sheet unmounts its content on close, taking the button-owned dialog with it. Dialog state moved to `hooks/use-company-knowledge-book.ts`; the mobile nav renders the dialog outside the Sheet
      test: test-driven-debugging · unit (dom) — `__tests__/components/nav/mobile-nav-company-knowledge.test.tsx` was red (body held only the menu button), now green
- [x] ⚠️ WARNING · skipped · impl-review F2 · `ui/collapsible.tsx` callers, `nav/sidebar.tsx`, `report/sheet-report-parts.tsx` · Merge collides with the main checkout's uncommitted `ui/collapsible` rewrite (export rename + two overlapping hunks) — resolved at merge time, not in this branch: the other agent's final version doesn't exist yet. `pnpm build` runs in the main checkout after the merge
- [x] ⚠️ WARNING · fixed · impl-review F3 · `kosztorys/editor/dialogs/sheet/sheet-import-dialog.tsx:222` · `h-7` lost to `data-[size=default]:h-9` — trigger now `size="xs"`, matching its `toolbarSm` sibling
      test: no automated test — a class-merge height; manual check covers the import dialog
- [x] ⚠️ WARNING · fixed · impl-review F4 · `worker-reports/worker-report-review.tsx:411` · Group headings lost uppercase (buttons reset `text-transform`) — `uppercase` back on the `TextButton`
      test: no automated test — cosmetic
- [x] ⚠️ WARNING · fixed · impl-review F5 · `kosztorys/summary/totals-panel-overlay.tsx:50` · Drag-handle tooltip reopened stuck-open after click-to-close — `setHintOpen(false)` on pointer down
      test: no automated test — a hover tooltip's open state; cosmetic
- [x] ⚠️ WARNING · fixed · impl-review F6 · `census.md` close-out · Four plan items neither swapped nor listed — the shared form-errors notice dropped (each is already one `Description tone="error"` line), Badge `pending`/`positive` + inspection-form orange skipped as a visible colour change for the owner, `toolbarSm` kept; all four now listed with reasons
- [x] ⚠️ WARNING · fixed · impl-review F7 · `eslint-rules/no-hand-rolled-ui.mjs` · Width check ignored `FormDialogShell contentClassName`; `iframe title` and `import type` were false positives; lucide `Loader` missing — all four fixed, spec case corrected, both iframe disables removed
      test: TDD · unit — rule spec gains the iframe-valid and `Loader`-invalid cases, `contentClassName` case replaces the untypeable one (30/30)
- [x] 🔵 OBSERVATION · fixed · impl-review F8 + code-review · `nav/mobile-nav.tsx:68` · Menu button outside `SheetTrigger` (no focus return, dangling `aria-controls`), overlay not `sm:hidden` on rotate — button wrapped in `SheetTrigger asChild`, `id`/`aria-controls` dropped, `SheetContent overlayClassName` added. `setScrollLocked` kept: the Safari `100vh` case needs the phone check
      test: no automated test — existing nav specs green; rotate case is a manual check
- [x] 🔵 OBSERVATION · fixed · impl-review F9 · `worker-reports/review-lines-table.tsx:146` · Note no longer centred under the qty input — `justify-center`
- [x] 🔵 OBSERVATION · dropped · impl-review F9 · `ui/toggle-stat-buttons.tsx:86` · Info-tooltip label reads „Co to jest: X:" — screen-reader label only, no visible effect
- [x] 🔵 OBSERVATION · dropped · impl-review F9 · `stage-completed-mark.tsx`, `ExternalLink`/`TextButton` restyles, `promote-lead-dialog`, `filter-chip` X title, `extra-works` footer, `alert-dialog` title · Small restyles from the swaps — the primitive's look is the point of the sweep; the stage-mark tooltip is a manual-check item
- [x] 🔵 OBSERVATION · dropped · impl-review F10 + code-review · `kosztorys/editor/dialogs/stage-split/stage-split-dialog.tsx:142` · `role="radio"` with no `radiogroup` — semantics only, no behaviour
- [x] 🔵 OBSERVATION · dismissed · impl-review F10 · `ui/button.tsx:79` · `withPendingSpinner` swaps any component first child — every caller leads with an icon; the rule is the comment above it
- [x] 🔵 OBSERVATION · skipped · impl-review F10 · `forms/settle-payouts-form/settle-payouts-form.tsx:256` · `FormFooter` adds the portal loader, the errors line and a hidden keep-open checkbox — the app-wide footer behaviour, kept; listed as a manual check
- [x] 🔵 OBSERVATION · dismissed · impl-review F10 · Phase 2 `isNegativeMoney` vs planned `signedMoneyColor` — moved to `lib/utils/round-to-cents` this gate; equivalent, recorded here
- [x] 🔵 OBSERVATION · dismissed · code-review · `ui/row-actions/row-action-button.tsx:75` · `disabled || pending` span wrapper remounts the button mid-click — same remount the pre-sweep `disabled={pending}` callers had
- [x] 🔵 OBSERVATION · dismissed · code-review · `pwa/push-toggle.tsx:26` · `refused` state resets when the drawer unmounts — `refused` is only set when `Notification.permission === 'denied'`, which the remount reads back and shows the same notice
- [x] fixed · tailwind-v4-audit · `ui/textarea.tsx:17` · `min-h-[68px]` → `min-h-17`
- [x] fixed · tailwind-v4-audit · `ui/select.tsx:23` · `data-[placeholder]:` → `data-placeholder:`
- [x] dropped · tailwind-v4-audit · `telmak-check-dialog.tsx:147`, `duplicate-finder-dialog.tsx:101` · `sm:max-h-[94vh]` — two sites, a token would only rename it
- [x] dismissed · tailwind-v4-audit · `shadow-sm` / `rounded-sm` · valid v4 utilities
- [x] fixed · comment-noise-audit · `eslint-rules/no-hand-rolled-ui.mjs:9` · comment restating `classStrings` — deleted
- [x] fixed · comment-noise-audit · `section-color-picker.tsx:15,23`, `ai-review-columns.tsx:151`, `section-header-cell.tsx:160`, `materials-transactions-table.tsx:94`, `media-preview-trigger.tsx:23`, `media-strip.tsx:52`, `sidebar.tsx:56` · verbose suppression reasons — trimmed
- [x] fixed · comment-noise-audit · `totals-panel-overlay.tsx:3` · claimed `ui/collapsible` blocks `forceMount` — it passes through; reason corrected (census too)
- [x] fixed · comment-noise-audit · `media-preview-dialog.tsx:257`, `sheets/iframe-view.tsx:36` · iframe `title` disables — rule exempts `iframe`, disables removed
- [x] dismissed · comment-noise-audit · `filters/filter-chip.tsx:28`, `sheets/sync-button.tsx:92,103` · reasons "say what" — „truncation reveal" is the why: the native title shows the clipped label
- [x] dismissed · comment-noise-audit · `ui/button.tsx:78` · comment states the icon-vs-content rule the code can't show
- [x] fixed · structure-scatter-audit S1 · `ui/loader/spinner.tsx` · `Spinner` duplicated `ContentLoading` — deleted, three callers on `ContentLoading`; `BlockLoading` built on it; `inline-loading.tsx` moved into `ui/loader/`
- [x] fixed · module-cohesion-audit F1/C3/S4 · `ui/signed-money-display.tsx:8` · `isNegativeMoney` (pure money helper) lived in a component file — moved to `lib/utils/round-to-cents.ts`, 4 importers updated
- [x] dropped · module-cohesion-audit C1/C2 · `ui/section-header.tsx`, `ui/panel.tsx` · class tokens beside the primitive that renders them (the `buttonVariants` pattern); a move is ~30 import rewrites for no behaviour
- [x] dropped · structure-scatter-audit F2/S2 · `ui/badge-border.ts` · two importers; folding it into `styles/color-tokens` only moves it
- [x] dropped · feature-first-structure C4 · `ui/text-link.tsx` → `text-action.tsx` · a rename across call sites; `TextLink` is the module's main export
- [x] dropped · module-cohesion-audit C5 · `view-settings-fields.tsx:9` `GROUP_LEGEND_CLASS` → `GroupLegend` · three sites, the component would restate `FieldLegend variant tone className`
- [x] fixed · simplify · `ui/datasheet-grid/header-menu.tsx` · `triggerTitle` duplicated `tip` — removed; `sort-header` / `stage-header` pass `tip`
- [x] fixed · simplify · `ui/search-select.tsx` · `trigger` render prop had no production caller — removed with its design demo
- [x] fixed · simplify + reuse-scan · `media-preview-dialog.tsx`, `zoomable-preview-image.tsx`, `TitledPageLoading` · same centred overlay written three times — `OverlayLoading` in `ui/loader/page-loading.tsx`
- [x] fixed · simplify · `ui/warning-banner.tsx` · `bordered` prop had one caller — removed; `settlement-plane-warning` moved onto `Description tone="error"`, design demo line dropped
- [x] fixed · simplify · `worker-reports/review-lines-table.tsx` · `WARNING_NOTE` hand-rolled spans — `Description tone="warning" size="xs" withIcon={false}`
- [x] fixed · simplify · `nav/mobile-nav.tsx` · `onClick={openDrawer}` beside `onOpenChange` — the Sheet's `onOpenChange` opens through `openDrawer`
- [x] fixed · simplify · `company-knowledge/company-knowledge-button.tsx` · dual-mode `book?` prop — split into a pure `CompanyKnowledgeTrigger` (mobile nav) and the `CompanyKnowledgeButton` composite (top nav); `CompanyKnowledgeBookT` dropped
- [x] fixed · simplify · `ui/balance-cell.tsx` · two imports from `round-to-cents` — merged
- [x] dropped · simplify · `ui/text-link.tsx` · `TextLink`/`TextButton` factory — two components, a factory adds indirection for no reuse
- [x] dropped · simplify · `line-items-field.tsx:462`, `paragon-footer.tsx:47` · shared label class — two sites
- [x] dropped · simplify · `ui/signed-money-display.tsx` · `signedMoneyColor` via sign helpers — three-way branch reads clearer as is
- [x] dropped · simplify · `ui/sheet.tsx` · unused `SheetDescription` / `SheetClose` — the primitive's standard API
- [x] skipped · simplify · `report/sheet-report-parts.tsx` · `ReportTable` header union → `headerClassName` — file overlaps the main checkout's uncommitted edits (F2); left for after the merge
- [x] fixed · reuse-scan · `ui/description.tsx` · `tone="error" withIcon={false}` repeated at 26 sites — the error tone now defaults to no icon; the 8 iconed error notes pass `withIcon`
- [x] fixed · reuse-scan · `ui/button.tsx` · `variant="link" size="inline" className="text-xs"` × 8 — new `inlineXs` size
- [x] fixed · reuse-scan · `ui/auth-submit-button.tsx`, `line-items-field.tsx`, `fill-catalogue-translations-button.tsx` · hand-rolled spinner/disabled — Button `pending`
- [x] fixed · reuse-scan · `add-sheet-dialog`, `sheet-setup-dialog`, `link-sheet-to-investment-dialog`, `sheets/sync-button`, `lead-assets-dialog`, `ui/dialog-actions` · `disabled={pending}` without the spinner — Button `pending` (adds the standard spinner)
- [x] fixed · reuse-scan · `kosztorys/summary/model/settlement-groups.ts`, `acceptance-protocol/settlement.ts` · `roundToCents(x) < 0` — `isNegativeMoney`
- [x] fixed · reuse-scan · `ui/badge.tsx` · remove button hand-restyled `ghostDestructive` — `Button variant="ghostDestructive" size="inline"`
- [x] dropped · reuse-scan · `tables/users.tsx:58`, `tables/investments.tsx:270` · `SettleAmountButton` — children differ; the wrapper's props would equal the code
- [x] dropped · reuse-scan · preset/catalogue dialogs · `EmptyState` padding overrides — a `compact` size would only rename two padding strings
- [x] dropped · reuse-scan · `design/sections/*` · bordered frames → `Panel` — showcase page only

## Simplify pass

Ran /simplify + primitive-reuse-scan — 14 applied, 1 skipped, 7 dropped; each folded into ## Findings (tagged `simplify` / `reuse-scan`).

## Tests & suite

Deferred by user — typecheck, lint, specs and `pnpm build` to run on staging after the merge (3f237f4c2).
