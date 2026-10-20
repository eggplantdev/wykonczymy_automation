# Census — hand-rolled UI outside (and inside) `ui/`

2026-10-20, staging @ `8d60d7f82` + `94e30d52e` (shared `ui/collapsible.tsx`). Five read-only passes,
every hit opened and verified. Paths relative to `src/`. **Re-grep before editing** — line numbers drift.

Swap kinds: **=** identical once the missing piece exists · **Δ** visible look change (owner call) ·
**legit** stays, with the reason.

## 0. Bugs found on the way (fix test-first)

- `components/ui/input.tsx:14` — `focus-visible:ring-none` is not a Tailwind utility: `Input` has no
  focus ring while Textarea/SelectTrigger/Checkbox do.
- Sign colour without rounding (a −1e-13 residue paints „0,00 zł" red), should use `signedMoneyColor`:
  `components/users/owned-registers-section.tsx:59,65`,
  `components/kosztorys/summary/blocks/subcontractor-headline-summary.tsx:69`,
  `components/kosztorys/summary/blocks/subcontractor-worker-totals.tsx:38-41`.
- `components/kosztorys/summary/kosztorys-totals-panel-toggle.tsx:23` — `title` on a disabled Button
  never shows (`disabled:pointer-events-none`); also no `aria-expanded`.
- `app/(auth)/zaloguj/login-form.tsx:84` — full-screen `Loader` on top of `AuthSubmitButton`'s spinner.
- `components/kosztorys/summary/tables/materials-transactions-table.tsx:223-232` — footer finds its
  column by counting; → `ColumnTotalRow columnId=…` (=).

## 1. Missing pieces (add to `ui/` first; each unlocks the swaps listed)

| Piece | Unlocks |
|---|---|
| `Button` sizes `2xs` (h-6 px-2 text-xs), `iconSm` (size-7), `touch` (h-11), `iconTouch` (size-11, svg 7), `inline` (h-auto p-0), `row` | §2 B |
| `Button` `pending` prop (leading icon → `GradientSpinner`) | §6 A (12 sites) |
| `Button` `active` variant (nav active state) | `nav/nav-link-item.tsx:36`, `nav/trash-button.tsx:29` |
| `--color-warning` token + `warning` tone on `Description`, `WarningBanner`, Button outline | §7, amber sites |
| `TextButton` / `TextLink` (muted xs text action) | `ui/history-back-button.tsx:14`, `ui/auth-link.tsx:15`, `ui/external-link.tsx:14`, `ui/info-tooltip.tsx:36`, `kosztorys/editor/grid/menus/section-color-picker.tsx:36` |
| `InlineLoading({label})`, `BlockLoading` | §6 B–D |
| `ToggleGroup variant="muted"` (or accept the bordered look) | `nav/ui-scale-switch.tsx:43`, `transfers/cards/transfer-view-switch.tsx:23` |
| `CollapsibleChevron variant="side"` (right→down) | `grid/cells/section-header-cell.tsx:89`, `dialogs/reorder/reorder-dialog.tsx:279` |
| `CollapsibleContent` outer-className / no-animate | `kosztorys/summary/totals-panel-overlay.tsx` |
| `Sheet` (Radix Dialog, side=left) | `nav/mobile-nav.tsx:42-137` (no Esc, no focus trap) |
| `AlertDialogHeader` / `AlertDialogFooter` exported; `ConfirmDialog` built on them | `dialogs/new-item/catalogue-collision-confirm.tsx:43,70` |
| `FormDialogShell` `confirmVariant`, `cancelLabel`, `showCloseButton` | §3 |
| `DialogHeader.description: ReactNode`; `DialogBody` slot | `company-knowledge/company-knowledge-dialog.tsx:24`; `dialogs/form-dialog.tsx:61`, `dialogs/settle-payouts-dialog.tsx:26` |
| `Panel` (bare card shell, tones muted/alert; `SettingsCard` composes it) + `BORDERED_LIST_CLASS` in `ui/`; move `CARD_SHELL_CLASS`/`CARD_LIST_CLASS` out of `transfers/cards/` | §4 |
| `SectionHeader size`, `SUBSECTION_TITLE_CLASS`, `EYEBROW_CLASS` | §5 |
| `Badge` `section` tone, pill shape + trailing action; solid appearance (absorbs `CountBadge`) | `worker-reports/section-pill.tsx:4`, `filters/filter-chip.tsx:14` |
| `Combobox variant="field"` + `invalid`; `SearchSelect` `size` + `trigger` slot | §8 |
| `Label size="xs" tone="muted"`, `CheckboxRow variant="plain"`, `Field` gap option, `FieldLegend` muted | §8 |
| `WarningBanner bordered={false}` | `kosztorys/summary/blocks/settlement-plane-warning.tsx:16` |
| `BalanceCell` settled tone (green at 0) | `forms/settle-payouts-form/settle-payouts-table.tsx:148`, `tables/investments.tsx:276`, `tables/users.tsx:58` |
| `formatSignedPLN` | `grid/cells/divergence-cell.tsx:13-28`; `grid/cells/section-header-cell.tsx:137` → plain `formatPLN` |
| `ReportTable` `headers: {content, className}[]` | `dialogs/catalogue/catalogue-diff-table.tsx:89-120` |
| `EmptyState size="inline"` | §7 empty states |
| sticky/updatable toast helper | `hooks/use-file-archive.ts:4,34,128` |

## 2. Buttons and links

**A. Raw `<button>` with button styling:** `filters/filter-chip.tsx:29` (iconSm round),
`kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx:67` (ghost icon, Δ),
`dialogs/stage-split/stage-split-dialog.tsx:138` (role=checkbox; really a radio),
`media/media-strip.tsx:104,117` (`OVERLAY_BUTTON`), `media/media-preview-trigger.tsx:24` (chip/compact =,
`field` branch = search-select trigger copy), `transfers/note-popover.tsx:22-25` (hand-copied ghost
icon), `app/(frontend)/design/showcase-toc.tsx:9`.

**B. `Button` + className rebuilding a missing size:**
- `size="sm"` + `h-7 px-2` → `xs` (= now): `kosztorys/summary/settings/discount-value-field.tsx:63`,
  `discount-amount-pair-field.tsx:88`.
- `2xs`: `filters/active-filters-bar.tsx:43`, `dialogs/reorder/reorder-dialog.tsx:294`.
- `iconSm`: `dialogs/add-sheet-dialog.tsx:79`, `nav/sidebar.tsx:101`.
- `iconTouch`: `nav/standalone-back-button.tsx:14`, `nav/mobile-nav.tsx:67,91`.
- `touch`: `payouts/payouts-to-confirm.tsx:84,94`; `ui/external-link.tsx:15` (re-implements Button default).
- `inline` (`variant="link"` + `h-auto p-0`, 10×): `tables/investments.tsx:271`, `tables/users.tsx:56`,
  `review-lines-table.tsx:204,279,324`, `sheet-column-picker.tsx:58`, `catalogue-diff-table.tsx:84,165`,
  `catalogue-missing-list.tsx:53`, `catalogue-compare-dialog.tsx:144`.
- `row`: `catalogue-candidate-row.tsx:47`, `catalogue-missing-list.tsx:75`.
- warning outline: `kosztorys/editor/toolbar/worker-reports-button.tsx:12`.

**C. Links:** `OptionalLink` (=): `summary/tabs/summary-overview-tab.tsx:132`,
`summary/tables/summary-totals-table.tsx:56`, `summary/tables/deposits-table.tsx:53`,
`tables/investments.tsx:99`, `tables/sheets.tsx:86`; same name-link class string 4×:
`nav/template-crumb.tsx:21`, `nav/investment-crumb.tsx:22`, `nav/sidebar.tsx:92`, `nav/mobile-nav.tsx:119`.
`text-primary` underline links → `TextLink`: `app/(frontend)/not-found.tsx:11`,
`kosztorys/editor/history/history-banner.tsx:28`, `leads/promote-lead-dialog.tsx:49`. External:
`sheet-compare-dialog.tsx:378`, `tables/expense-duplicates.tsx:74` (Δ with `ExternalLink`).

**Inside `ui/`:** `button.tsx` near-duplicate variants `activeFilter`/`greenOutline`,
`destructiveOutline`/`redOutline`/`outlineDestructive`, 8 never-referenced variants;
`simple-select.tsx:38` `toolbarSm` == `xs`; `count-badge.tsx:9` separate pill; `toggle-stat-buttons.tsx:84`
copies `stat-button.tsx` markup; `stat-button.tsx` inline `style` border colour; `dot-badge.tsx` vs
`transfers/cards/card-chip.tsx` (two border-colour maps).

## 3. Dialogs, overlays, tooltips

- Hand-built `Dialog + DialogHeader + body + DialogActions` → `FormDialogShell` (=):
  `sheets/sync-button.tsx:128`, `dialogs/preset/reload-from-preset-dialog.tsx:99`,
  `dialogs/clear-kosztorys-dialog.tsx:38`, `transfers/cancel-transfer-button.tsx:77`,
  `payouts/reject-payout-dialog.tsx:46`.
- Header/footer by hand: `kosztorys/worker-report/extra-works-dialog-button.tsx:47,60` (Δ).
- Primary button at end of body instead of footer (Δ): `worker-expenses/expense-draft-dialog.tsx:200`,
  `worker-reports/scan-report-dialog.tsx:228`, `dialogs/add-sheet-dialog.tsx:116`.
- Raw widths instead of `max-w-dialog*` (28): `sm:max-w-md` ×14 (expense-draft-dialog:134,
  cancel-transfer-button:78, pwa/install-app-button:52, sheet-setup-dialog:53, media-upload-dialog:46,
  add-sheet-dialog:56, users/report-work-button:36, link-sheet-to-investment-dialog:58,
  kosztorys-client-view-dialog:62, kosztorys-worker-view-dialog:47, kosztorys-worker-share-dialog:24,
  kosztorys-share-dialog:32, reject-payout-dialog:47, kosztorys-versions-drawer:83) +
  catalogue-collision-confirm:42; `sm:max-w-lg` ×4 (lead-assets-dialog:128, scan-report-dialog:152,
  reload-from-preset-dialog:100, clear-kosztorys-dialog:39); stage-split-dialog:92 (xl),
  sync-button:129 + company-knowledge-dialog:23 (2xl), add-sections-from-preset-dialog:96 (3xl),
  settle-payouts-dialog:24 (4xl), reorder-dialog:208 (7xl); `sm:max-h-[94vh] sm:max-w-[96vw]` in
  telmak-check-dialog:145 + duplicate-finder-dialog:97; worker-reports-dialog:38. **Δ:** md 448→420.
  Legit: `media/media-preview-dialog.tsx:227`.
- Native `title=` instead of `SimpleTooltip`/`HintTooltip` (Δ): `nav/nav-openrouter-balance.tsx:17`,
  `kosztorys/editor/stage-completed-mark.tsx:10`, `tables/users.tsx:155`, `fleet/alert-badge.tsx:15`,
  `orders/order-status-badge.tsx:49`, `transfers/cards/transfer-view-switch.tsx:31`,
  `grid/menus/section-color-picker.tsx:20`, `kosztorys/summary/totals-panel-overlay.tsx:95`,
  `filters/filter-chip.tsx:33`, `filters/filter-trigger-button.tsx:8`. Legit: truncation reveals
  (`filter-chip.tsx:23`, `ui/pie-legend.tsx:18`), `grid/cells/section-header-cell.tsx:160` (per-cell cost).
- **Inside `ui/`:** two title styles (`dialog.tsx:127` vs `alert-dialog.tsx:60`), two footers
  (`confirm-dialog.tsx:51` vs `DialogFooter`), two headers, widths ignoring tokens
  (`form-dialog-shell.tsx:37` `sm:max-w-sm`, `alert-dialog.tsx:46`, `confirm-dialog.tsx:42`), native
  titles in `toggle-group.tsx:83`, `env-badge.tsx:43`, `datasheet-grid/header-menu.tsx:36`.
- Legit portals: `kosztorys-editor-body.tsx:498,555,563`, `worker-report/report-mode-footer.tsx:19`.

## 4. Cards, panels, lists

- Shells → `Panel`: `company-knowledge/knowledge-entry-row.tsx:35`,
  `company-knowledge/company-knowledge-book.tsx:189`, `forms/form-components/register-balance-summary.tsx:16`
  (Δ), `kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx:157`,
  `worker-expenses/expense-draft-duplicate-hints.tsx:106`.
- Bordered lists → `BORDERED_LIST_CLASS`: `trash/trash-section.tsx:17`,
  `dialogs/worker-reports/worker-reports-list.tsx:52`, `reload-from-preset-dialog.tsx:115`,
  `reorder-dialog.tsx:243`, `tables/data-table/data-table.tsx:210`.
- `CARD_SHELL_CLASS`/`CARD_LIST_CLASS` imported cross-feature (`payouts/payouts-to-confirm.tsx:7`).
- **Inside `ui/`:** `settings-card.tsx:12` vs `auth-success-card.tsx:9`.

## 5. Headings (only `equipment/held-equipment-section.tsx:32` uses `SectionHeader`)

- `text-sm font-semibold` (6): `worker-report/sent-reports.tsx:13`, `draft-extra-works.tsx:11`,
  `fleet/inspection-history.tsx:104`, `fleet/vehicle-costs.tsx:41,63`, `summary/settings/settings-section.tsx:19`.
- `text-sm font-medium` (10): `leads/lead-answers-dialog.tsx:41`, `lead-assets-dialog.tsx:164,197`,
  `acceptance-protocol-dialog.tsx:165,187`, `expense-draft-duplicate-hints.tsx:113`,
  `investments/investment-overview.tsx:87`, `app/(frontend)/kosztorysy/page.tsx:62`,
  `summary/tabs/summary-overview-tab.tsx:128`.
- base `font-medium` (5): `duplicate-finder-dialog.tsx:142,159`, `telmak-check-dialog.tsx:194,218`,
  `knowledge-entry-row.tsx:47`.
- `text-base font-semibold` (2): `trash/trash-section.tsx:16`, `worker-report-review.tsx:304`.
- `text-lg font-semibold` written out (1): `worker-report/worker-report-form.tsx:46`.
- Uppercase eyebrows (5, two variants): `worker-reports/report-preview-dialog.tsx:78`,
  `worker-report-review.tsx:398`, `worker-reports-list.tsx:49`, `kosztorys-versions-drawer.tsx:93,110`.
- **Inside `ui/`:** five scales; `SECTION_TITLE_CLASS` written out in `empty-state.tsx:14`,
  `dialog.tsx:127`, `alert-dialog.tsx:60`.
- Legit: `app/(legal)/*` (own `<html>`), `sheets/iframe-view.tsx:20`, `preview-header-actions.tsx:35`.

## 6. Loading

- **A. `Loader2` + `animate-spin` in buttons** → `Button pending` (Δ spinner look):
  `tables/telmak-check.tsx:127`, `worker-expenses/open-expense-draft-button.tsx:15`,
  `worker-reports/worker-report-row-actions.tsx:30` (needs `RowActionButton pending`),
  `transfers/invoice-download-dialog.tsx:94`, `transfers/print-transfers-button.tsx:82`,
  `transfers/duplicate-finder-dialog.tsx:110`, `worker-expenses/restore-expense-draft-button.tsx:37`,
  `transfers/invoice-cell.tsx:54`, `pwa/push-toggle.tsx:62,72`, `pwa/install-app-button.tsx:80`,
  `summary/tables/materials-transactions-table.tsx:206`, `investments/investment-assets-control.tsx:64`.
- **B. spinner + label** → `InlineLoading`: `telmak-check-dialog.tsx:178`, `invoice-download-dialog.tsx:113`.
- **C. text-only „Wczytywanie…"** → `InlineLoading`: `forms/form-fields/source-register-field.tsx:43`,
  `view-settings/kosztorys-worker-view-dialog.tsx:89`, `view-settings/client-view-settings-form.tsx:23`,
  `preset/add-sections-from-preset-dialog.tsx:103`, `preset/reload-from-preset-dialog.tsx:104`,
  `kosztorys-versions-drawer.tsx:86`, `worker-reports/worker-reports-dialog.tsx:143`; with a stray Info
  icon: `section-translation-dialog.tsx:63`, `catalogue-item-from-kosztorys-dialog.tsx:76`,
  `save-item-to-catalogue-dialog.tsx:81`.
- **D. centred box, three spinners** → `BlockLoading`: `dialogs/settle-payouts-dialog.tsx:68`,
  `company-knowledge/company-knowledge-dialog.tsx:37`, `investments/contract-dialog.tsx:40`.
- **Inside `ui/`: six looks** — `gradient-spinner`, `loader/spinner` (double `role=status`),
  `auth-submit-button.tsx:31` LoaderCircle, `upload-button.tsx:23` Loader2, `ContentLoading` 🚧,
  pulse bar. Pick `GradientSpinner`.
- Legit: `nav/refresh-data-button.tsx:39`, image overlays in `media/*`.

## 7. Text feedback: errors, hints, empty states, banners, status colour

- **Error lines** `<p|span className="text-destructive text-sm|xs">` (≈25) → `Description tone="error"
  withIcon={false}` (=) or `FieldError` under a field: `worker-reports/scan-report-dialog.tsx:192`,
  `settle-payouts-table.tsx:117`, `stage-split-dialog.tsx:209`, `add-items-from-catalogue-dialog.tsx:221`,
  `duplicate-finder-dialog.tsx:120,126`, `review-lines-table.tsx:164,188`, `worker-report-review.tsx:351`,
  `share/share-link-panel.tsx:69`, `settle-payouts-form.tsx:260`, `use-expense-draft-acceptance.tsx:245`,
  `expense-draft-duplicate-status.tsx:26`, `dialogs/settle-payouts-dialog.tsx:66`,
  `sheet-problems-block.tsx:37`, `report/sheet-report-dialog.tsx:41`, `sheet-compare-dialog.tsx:150`,
  `app/(auth)/zaloguj/login-form.tsx:74`, `zapomniane-haslo/forgot-password-form.tsx:60`,
  `reset-hasla/reset-password-form.tsx:55,101`. „Form has errors" written 3×: `form-footer.tsx:65`,
  `worker-report/send-bar.tsx:78`, `worker-report/extra-works-dialog-button.tsx:62` → one notice.
  Legit: `invoice-download-dialog.tsx:111` (inside an aria-live `<p>`), table cells
  (`catalogue-diff-table.tsx:223`, `tables/expense-drafts.tsx:175`).
- **Hints** → `Description withIcon={false}` / `FieldDescription`:
  `summary/settings/materials-net-pricing-control.tsx:45`, `company-knowledge-book.tsx:191`,
  `catalogue-swap-dialog.tsx:122`, `stage-split-dialog.tsx:105`, `review-lines-table.tsx:145`.
- **Empty states** (raw `<p>`, 3 competing conventions) → `EmptyState size="inline"`:
  `history/history-dialog.tsx:28`, `kosztorys-versions-drawer.tsx:88`, `settle-payouts-form.tsx:224`,
  `duplicate-finder-dialog.tsx:136`, `add-sections-from-preset-dialog.tsx:105,124`,
  `reload-from-preset-dialog.tsx:117`, `catalogue-swap-dialog.tsx:104` +
  `add-items-from-catalogue-dialog.tsx:212` (same text), `worker-reports-list.tsx:20`,
  `worker-report-review.tsx:381`, `transfers/cards/transfer-card-list.tsx:19`, `sheets/sync-button.tsx:137`;
  `worker-report-form.tsx:44` ≈ `EmptyState`.
- **Banners:** `settlement-plane-warning.tsx:16` (borderless WarningBanner),
  `kosztorys/editor/template-catalogue-banner.tsx:5` (amber strip). Raw `AlertTriangle` → `AlertIcon` (=):
  `app/(frontend)/flota/[id]/page.tsx:68`, `fleet/alert-badge.tsx:16`.
- **Warning spelled three ways:** `text-amber-600` (worker-reports-button, template-catalogue-banner,
  review-lines-table `WARNING_NOTE`, sheet-rates-block, sheet-report-parts, report-grid, sheet-import-dialog,
  sheet-report-block, sheet-compare-dialog, catalogue-diff-table, catalogue-candidate-row,
  edit-catalogue-item-dialog), `text-chart-orange` (`fleet/deadline-cell.tsx`, `equipment/warranty-cell.tsx`,
  `inspection-form.tsx:195`), Badge `pending`.
- **Raw green/red for status:** `sheet-rates-block.tsx:243-247,265`, `sheet-report-block.tsx`,
  `stage-completed-mark.tsx`, `sheets/sync-button.tsx` (emerald dot); inside `ui/`:
  `auth-submit-button.tsx`, `auth-success-card.tsx:9`, `button.tsx` `activeFilter`, `language-label.tsx`,
  `env-badge.tsx`. Green spelled three ways (green-600, chart-green, Badge positive teal).
- **Money:** green-at-zero rule written 3× (see `BalanceCell` settled tone);
  three sign-colour paths inside `ui/` (`BalanceCell`, `signedMoneyColor`, `SummaryValueCell`).
- Toast bypass: `hooks/use-file-archive.ts`.

## 8. Form fields

- Hand-assembled Select → `SimpleSelect` (=): `worker-expenses/expense-draft-dialog.tsx:145,164` (+ link
  labels via `htmlFor`).
- Raw `<label>` around Checkbox → `CheckboxRow variant="plain"`: `filters/active-filter-label.tsx:17`,
  `form-components/form-footer.tsx:55`, `fleet/inspection-type-checkboxes.tsx:18`,
  `add-items-from-catalogue-dialog.tsx:171`, `summary/tables/margin-forecast-table.tsx:52`.
- Raw `<label>` / hand-rolled `flex-col gap-2` wrappers → `Field` + `FieldLabel` (Δ gap):
  `dialogs/add-sheet-dialog.tsx:93,105`, `expense-draft-dialog.tsx:142,161,191`,
  `scan-report-dialog.tsx:155,167`, `orders/order-pick-step.tsx:111,120,130,157`,
  `section-translation-dialog.tsx:66`, `leads/lead-assets-dialog.tsx:136`.
- `DecimalField withSave` re-implemented: `discount-value-field.tsx:51`, `discount-amount-pair-field.tsx:64,76`.
- Inline label + SimpleSelect (3×): `worker-report-review.tsx:325,335`, `catalogue-swap-dialog.tsx:77`.
- Muted group headings over CheckboxRows (3×): `view-settings/view-settings-fields.tsx:41,55`,
  `kosztorys-worker-view-dialog.tsx:76` → `FieldSet` + muted `FieldLegend`.
- Search/combobox: `worker-report/report-bar.tsx:23` (copy of `SearchFilterInput` at another size),
  `filters/filter-select.tsx:47` (copy of `SearchSelect` with another trigger),
  `leads/lead-assets-dialog.tsx:135` (`EntityComboboxField` without the form).
- Pasted Input/Trigger class strings: `form-components/form-creatable-combobox.tsx:25`,
  `add-items-from-catalogue-dialog.tsx:158`, `catalogue-swap-dialog.tsx:84` (use `invalid`),
  `sheet-import-dialog.tsx:221`, `review-lines-table.tsx:202`, `media/media-preview-trigger.tsx:34`.
- Misuse: `<Label>` as plain text in `expense-form/paragon-footer.tsx:48`, `line-items-field.tsx:462`.
- **Inside `ui/`:** `decimal-input.tsx` second input look; `search-select.tsx:67` copies the SelectTrigger
  class; `combobox.tsx:115` no field look; `FieldError` vs `Description` error and `FieldDescription` vs
  `Description` hint (two systems each); muted xs label written twice (`decimal-field.tsx:94`,
  `inline-mode-select.tsx:29`); `reason-field.tsx:42` raw `<p>`; `file-input.tsx:123` partial Input copy;
  `textarea.tsx` lacks dark `aria-invalid` ring.
- Legit: hidden file inputs (`line-item-invoice-field.tsx:64`, `line-items-field.tsx:393`).

## 9. Disclosure, tabs, overlays

- Collapsibles: done in `94e30d52e` (`ui/collapsible.tsx`). Left: `history/history-banner.tsx:38`
  (native `<details>`, Δ), `dialogs/reorder/reorder-dialog.tsx:279` (side chevron, add `aria-expanded`),
  `toolbar/kosztorys-editor-toolbar.tsx:74` + `summary/kosztorys-totals-panel-toggle.tsx:20` →
  `CollapsibleChevron` (=), `totals-panel-overlay.tsx:3` raw `@radix-ui/react-collapsible` import (Root =),
  `ui/env-badge-shell.tsx:40`.
- Segmented controls → `ToggleGroup`: `nav/ui-scale-switch.tsx:43`, `transfers/cards/transfer-view-switch.tsx:23`
  (byte-identical pair), `dialogs/worker-reports/worker-reports-list.tsx:30` (no `aria-pressed`),
  `telmak-check/telmak-check-dialog.tsx:208` (minor).
- Legit: `worker-report-review.tsx` groups (rows inside `<table>`), `grid/cells/section-header-cell.tsx`
  (virtualized grid cell), `toolbar` mobile tools panel (`sm:contents`), sidebar rail handle,
  `section-color-picker.tsx` swatch grid (fix its stale comment).
- No hand-built dropdowns/popovers/context menus.

## 10. Tables

- `catalogue-diff-table.tsx:89` → `ReportTable` with header classNames (=).
- `materials-transactions-table.tsx:223` → `ColumnTotalRow` (=, §0).
- `leads/lead-answers-dialog.tsx:30` → `InfoList divided` (Δ).
- Legit: `worker-report/worker-summary.tsx` (public worker page), `worker-report/branded-header.tsx:22`.

## Close-out (2026-10-20)

Every line above is swapped, except the ones below. The lint rule reports 0 hits with no suppressions
file. Each genuine exception carries an `eslint-disable-next-line local/no-hand-rolled-ui -- <reason>`
at its site.

Left, with reason:

- `kosztorys/summary/totals-panel-overlay.tsx` keeps the raw Radix import. It needs no animation and
  a className on Content; `ui/collapsible` forces both. Waiting on the in-flight `ui/collapsible`
  rewrite on staging.
- `reorder-dialog.tsx` section toggle and `grid/cells/section-header-cell.tsx:89` need a
  `CollapsibleChevron variant="side"`. Same wait.
- `filters/filter-select.tsx` → `SearchSelect`: `SearchSelect` always shows a search box, and both
  callers show none. Needs `searchable?: boolean` first.
- `orders/order-pick-step.tsx` Dostawca / Kontakt na miejscu: `Field` stretches every child, which
  would widen `SaveAsDefaultButton`.
- `leads/lead-assets-dialog.tsx:135` → `EntityComboboxField`: bound to a TanStack field, and this
  dialog has no form. Moved onto `Field` + `FieldLabel` → `SearchSelect`.
- `leads/lead-answers-dialog.tsx:30` → `InfoList divided`: one caller, so the prop would just restate
  its markup. Dropped.
- `kosztorys/tones.ts` → a `ReadOnlyCellText tone`: the tones also colour non-grid spans
  (`tables/work-catalogue.tsx`, the global settings value). Dropped.
- Discount fields → `DecimalField withSave`: async save with confirmation and a linked netto/brutto
  pair. Not the same field.
- `worker-report/report-bar.tsx` → `SearchFilterInput`: needs an `lg` size (h-10).
- `telmak-check-dialog.tsx:208` → `ToggleGroup`: a single button whose label flips; two segments
  would need new copy.
- The three „form has errors" notices (`form-footer`, `send-bar`, `extra-works-dialog-button`) stay
  separate: each is already `Description tone="error"` with its own copy and layout, so a shared
  component would restate that one line.
- Badge `pending` (amber) and `positive` (teal), and `inspection-form.tsx` `text-chart-orange`: moving
  them onto `warning` / `chart-green` changes colours users know. The owner's call, not a swap.
- `simple-select` `toolbarSm` stays as an alias of `size: 'xs'`; removing it only renames call sites.
