# App audit and refactor — Ledger

One line per finding, every box at a terminal disposition:
`- [x] · fixed|dismissed|dropped|skipped · CODE · path:line · reason`. A finding filed to Linear
(project Wykonczymy) carries the id; an open `[ ]` box is one still owed.

| Code     | Meaning                                |
| -------- | -------------------------------------- |
| `DUP`    | duplication                            |
| `LAYER`  | wrong home / layering breach           |
| `CYCLE`  | import cycle                           |
| `DEAD`   | dead code                              |
| `ACCESS` | role gate                              |
| `BUG`    | correctness                            |
| `MEMO`   | hand-written `useMemo` / `useCallback` |
| `GOD`    | oversized module                       |
| `NOISE`  | leftover noise                         |

## Baseline (2026-10-19, `28186af47`)

| Metric                   | Value                                                                                                                                                            | Instrument                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| LOC under `src/` (scope) | ~114 k                                                                                                                                                           | research.md                                                                    |
| Duplication              | 0.17 %                                                                                                                                                           | jscpd (research.md)                                                            |
| Import cycles            | 46 `no-circular` warnings                                                                                                                                        | `pnpm exec depcruise src --config .dependency-cruiser.cjs`                     |
| Hand-written memos       | 94 calls in 25 files                                                                                                                                             | `grep -rE '\buse(Memo\|Callback)\(' src` (`.ts`/`.tsx`, excluding `__tests__`) |
| Full-tree lint           | 1 error (`rules-of-hooks`, a spec), 52 warnings: 42 `no-unused-vars` (39 in frozen migrations), 7 `no-deprecated`, 2 `incompatible-library`, 1 `no-explicit-any` | `pnpm lint` (after the Phase 1 ignores)                                        |

## Phase 1 — Guards and ledger (2026-10-19)

Cycles after the phase: 45 (−1).

- [x] · fixed · `NOISE` · `eslint.config.mjs` · `pnpm lint` linted `.worktrees/` (763 messages) and
      `.playwright-mcp/` (454); both ignored, baseline counts in the table above
- [x] · fixed · `DEAD` · `src/lib/constants/sheets.ts:3` · `SHEET_STATUSES` existed only to derive
      `SheetStatusT`; the union is written out
- [x] · dismissed · `BUG` · `src/__tests__/components/forms/hooks/use-investment-from-url.test.ts:21` ·
      the one lint error (`rules-of-hooks`) is in a spec — `__tests__` is outside this change's scope
- [x] · dismissed · `NOISE` · `no-unused-vars` in `src/migrations/**` (39) and `src/__tests__/**` (2),
      `no-explicit-any` and `incompatible-library` in `src/__tests__/**` · outside scope; migrations are
      frozen history
- [x] · dismissed · `DEAD` · `src/app/(payload)/admin/[[...segments]]/page.tsx:18,26` · deprecated
      `AdminViewProps` in a file Payload regenerates
- [x] · skipped · `DEAD` · `src/components/transfers/print-transfers-button.tsx:70`,
      `src/lib/utils/print-window.ts:28` · deprecated `document.write` — Phase 3, together with the
      duplicated print path
- [x] · skipped · `DEAD` · `src/lib/ai/openrouter.ts:70`, `src/lib/ai/translate.ts:53`,
      `src/lib/ai/worker-report-scan.ts:41` · deprecated `generateObject` — Phase 3
- [x] · skipped · `MEMO` · `src/components/tables/data-table/data-table.tsx:135` · `incompatible-library`
      (TanStack Table under the React Compiler) — Phase 7 with the memo work
- [x] · fixed · `LAYER` · `.dependency-cruiser.cjs` · cut to `no-circular`: the other rules duplicated
      ESLint, `pnpm build` and knip, and `no-payload-graph-imports-env-server` pointed at a path that
      no longer exists (`src/lib/env.server.ts`)
- [x] · fixed · `LAYER` · `eslint.config.mjs` · `no-restricted-imports` for `src/components/ui/**`:
      no `@/components/*` outside `ui/`, no `@/stores/*`, no `@/lib/*` except `utils`, `i18n`,
      `table`, `env`; fires on a deliberate violation of each kind
- [x] · fixed · `LAYER` · `src/components/ui/badge.tsx:1` · `RoleBadge` (knows `RoleT`) moved to
      `src/components/users/role-badge.tsx`; `badge.tsx` keeps the role-agnostic `BADGE_BASE` /
      `BADGE_TONE`
- [x] · fixed · `LAYER` · `src/components/ui/pie-legend.tsx:1`, `src/components/ui/slice-pie.tsx:8` ·
      `formatPercent` from `lib/kosztorys` replaced by a required `formatShare` prop; both kosztorys
      callers pass `formatPercent` (its 99.9 %/100.1 % rule is a kosztorys rule, so it stays there)
- [x] · fixed · `LAYER` · `src/components/ui/form-dialog.tsx:4` · moved to
      `src/components/dialogs/form-dialog.tsx`: it is driven by `useOptimisticFormStore` in five
      places, and 25 consumers would each have had to thread that state in as props
- [x] · fixed · `LAYER` · `src/components/ui/pending-submit-indicator.tsx:4` · moved to
      `src/components/nav/pending-submit-indicator.tsx`: shell chrome over `usePendingStore`, mounted
      once in the `(frontend)` layout
- [x] · fixed · `LAYER` · `src/components/ui/use-history-back.ts` · moved to
      `src/hooks/use-history-back.ts` (consumers in `ui/` and `nav/`)
- [x] · fixed · `CYCLE` · `src/components/ui/column-order-dialog.tsx:13` ↔
      `src/components/ui/column-toggle-menu.tsx:14` · `ColumnToggleItemT` moved to
      `src/lib/table/column-order.ts` beside `ColumnRanksT`

## Phase 2 — Access fixes (2026-10-19)

Cycles after the phase: 42 (−3).

- [x] · fixed · `ACCESS` · `src/lib/actions/toggle-active.ts:86` · `toggleCashRegisterActive` had no
      scope: a MANAGER switched any kasa, the główna included. Now `canManageRegister` (owner ruling): a
      MANAGER switches only his own kasa and an EMPLOYEE's, never the główna or another manager's,
      the OWNER's or an ADMIN's; `toggle-active.db.test.ts` failed first. `/kasy` renders the badge
      read-only on the kasy he may not switch. A first pass blocked MANAGER entirely — misread ruling,
      corrected. Role-rule document: EX-1098
- [x] · fixed · `ACCESS` · `src/lib/actions/cash-register-trash.ts:22` · the trash, restore and „Usuń
      na zawsze" actions checked only the główna, so a MANAGER could bin another manager's or the
      OWNER's kasa; now the same `canManageRegister`, and `/kosz` lists only the kasy he may act on
      (`shapeTrashRows`). `cash-register-trash.db.test.ts` failed first
- [x] · fixed · `ACCESS` · `src/app/(frontend)/kasa/[id]/page.tsx:25` · `requireAuth` +
      `notFound()` replaced by `requireManagementPage`, so an EMPLOYEE lands on his own page; the
      `canViewRegister` 404 for MANAGER on a MAIN register stays
- [x] · fixed · `ACCESS` · `src/lib/actions/sheets-sync.ts` · `removeTransferFromSheet`,
      `syncSingleTransferToSheet`, `syncBulkExpensesToSheet` moved with the tab specs to
      `src/lib/google/transfer-sheet-sync.ts`, so they are no longer unauthenticated action endpoints;
      `sheets-sync.ts` exports only the wrapped actions
- [x] · fixed · `BUG` · `src/components/ui/balance-cell.tsx:11` · sign colour tested the raw amount, so
      a −0.004 residue printed „0,00 zł" in red; now tests `roundToCents(value)`. DOM spec failed
      first. Not `signedMoneyColor`: it paints positives green, which `BalanceCell` never did
- [x] · fixed · `BUG` · `src/components/forms/settle-payouts-form/settle-payouts-table.tsx:197` ·
      the „Pozostało" column had the same raw-sign test; rounded the same way

## Phase 3 — `lib/*` mechanical cleanups (2026-10-19)

Cycles after the phase: 42 (±0). knip: unused exports 36 → 30, unused exported types 42 → 0.

- [x] · fixed · `DUP` · `src/lib/queries/{transfer,lead,expense-draft,worker-report}-sort.ts` · four
      copies of the sort-param guard; one `serverSort(columns, defaultSort?)` factory in
      `src/lib/table/server-sort.ts`, each list's columns in its `sortable-columns.ts`
- [x] · fixed · `DUP` · seven collections · the `trashedAt` field written out seven times; now
      `trashedAtField()` (`src/collections/fields/trashed-at.ts`)
- [x] · fixed · `DUP` · `serialClash`, `registrationClash`, `emailClash`, `findEmailHolder` · one
      trashed-aware `uniqueClash` / `findUniqueHolder` (`src/lib/trash/unique-holder.ts`); messages
      unchanged
- [x] · fixed · `DUP` · `src/components/tables/cash-registers.tsx` · register-type labels and border
      colours moved to `src/lib/cash-registers/register-types.ts`; collection, form, table and chart
      read it. The admin-only „Główna” becomes „Główne” like everywhere else
- [x] · dismissed · `DUP` · `src/collections/transfers.ts:23` · options not built from
      `lib/constants/transfers.ts`: that list is in another order (the union order in
      `payload-types.ts` would change) and leaves out BLIK/CARD, which the DB enum keeps
- [x] · fixed · `DEAD` · `countUnreadLeads`, `countUnreadFleetDeadlines`, `countUnreadWarranties`,
      `countRejectedPayouts`, `countPendingExpenseDrafts`, `countPendingReports` · only specs called
      them; moved to `src/__tests__/helpers/stream-counts.ts`, where they stay the oracle
      `shell-badge-counts.db.test.ts` pins the merged statement to (drop them and a badge wired to the
      wrong column goes unnoticed)
- [x] · fixed · `DEAD` · 48 symbols (knip) · `export` dropped from constants and types used only in
      their own file
- [x] · dismissed · `DEAD` · `src/components/ui/*` shadcn re-exports, `src/__tests__/stubs/*`,
      `src/components/tables/column-meta.ts` · vendored component surface, module stubs and a module
      augmentation — knip can't see their consumers
- [x] · fixed · `LAYER` · `src/types/{fleet,leads,company-knowledge}.ts` · single-feature types moved to
      `src/lib/<feature>/types.ts` (fleet merged into the existing one)
- [x] · fixed · `LAYER` · `src/lib/utils/{scan-receipt-client,read-worker-report-client,net-suggestion}.ts`
      · each beside its one consumer (expense form, scan dialog, deposit form); specs follow
- [x] · fixed · `LAYER` · `src/lib/utils/category-costs.ts`, `src/lib/utils/date.ts` ·
      `costForCategory` inlined into its only caller; `getMonthDateRange` joined `date-range.ts`
- [x] · dismissed · `LAYER` · `src/lib/utils/default-cash-register.ts`,
      `src/lib/schemas/transfer-validation.ts`, `src/types/notifications.ts` · three or more consumers
      across directories — already in the right home. `date-range.ts` and `days.ts` don't overlap
      (filter ranges vs Warsaw-day maths)
- [x] · fixed · `DUP` · `src/components/transfers/print-transfers-button.tsx:70` · own
      write-close-print copy replaced by `writeAndPrint`
- [x] · skipped · `DEAD` · `src/lib/utils/print-window.ts:28` · `document.write` stays: the print window
      is a synchronously opened `about:blank` in quirks mode, and only a written `<!doctype html>`
      switches it to standards mode — a DOM import leaves it in quirks and can shift the printout,
      and a blob navigation can't start before the async fetch. Deprecated, not removed by browsers
- [x] · fixed · `DEAD` · `src/lib/ai/{openrouter,translate,worker-report-scan}.ts` · `generateObject`
      → `generateText` with `Output.object`

## Phase 4 — actions / db / queries boundary (2026-10-19)

Cycles after the phase: 42 (±0).

- [x] · fixed · `LAYER` · `src/lib/actions/{kosztorys-snapshots,template-snapshots,template-tree,investments,kosztorys-import,sheets-sync}.ts`
      · reads moved to `src/lib/queries/{snapshot-list,service-account-email,kosztorys-import-preview,material-sync-preview,kosztorys-revision}.ts`;
      the two revision probes share `probeRevision`
- [x] · dismissed · `LAYER` · `src/lib/actions/sheets-sync.ts` `compareWithSheet` · writes the
      measured quantities back (`setSheetMeasuredQty`) — a mutation, stays an action
- [x] · dismissed · `LAYER` · `src/lib/actions/worker-expense-drafts.ts:180` · persists the AI read —
      a mutation
- [x] · fixed · `LAYER` · `src/lib/db/worker-expense-drafts.ts` decide / merge / reject / reopen ·
      single statements in `lib/db`, flows in `src/lib/actions/expense-draft-flows.ts` (no
      `'use server'`, so they never become endpoints); refusals unchanged
- [x] · fixed · `LAYER` · `src/lib/db/snapshots.ts` `gcSnapshots`, `src/lib/db/template-snapshots.ts`
      `gcTemplateSnapshots` · one statement per retention band; the flows in
      `src/lib/kosztorys/snapshot-gc.ts`, the cron's only caller
- [x] · fixed · `LAYER` · `src/lib/db/worker-reports.ts` `readWorkerReport`, `readReportPreview` · row,
      lines and media as separate reads; assembled in `src/lib/queries/read-worker-report.ts`
- [x] · fixed · `SIZE` · `src/lib/actions/kosztorys.ts` · split into
      `kosztorys-{items,sections,settings,stages}.ts`
- [x] · fixed · `DUP` · `addItemAction` / template `addItemAction` new-item slot · one
      `resolveNewItemSlot` (`src/lib/kosztorys/new-item-slot.ts`); the local `ITEM_MISSING` twins
      replaced by `ITEM_NOT_FOUND`
- [x] · dropped · `DUP` · section insert in `kosztorys-sections.ts` vs `template-structure.ts` · the
      two differ only in the create call; a helper's parameters would be its whole body

## Phase 5 — Payload hooks out of `src/hooks` (2026-10-19)

Cycles after the phase: 42.

- [x] · fixed · `LAYER` · `src/hooks/{cash-registers,equipment,investments,media,transfers,users}`,
      `src/hooks/{prevent-delete,reset-bookkeeping,revalidate-collection}.ts` · moved to
      `src/collections/hooks/`, specs to `src/__tests__/collections/hooks/`; `src/hooks` is React hooks only
- [x] · fixed · `GUARD` · `eslint.config.mjs:103` · the „hooks ↛ `lib/cache/revalidate`" rule follows the
      move (probe import fails lint)
- [x] · dismissed · `LAYER` · `src/hooks/create-json-map-store.ts` · a client store factory for React
      hooks, not a Payload hook — stays

## Phase 6 — `components/*` cleanups (2026-10-19)

Cycles after the phase: 25 (42 after Phase 5). Every `components/*` directory audited except
`kosztorys/editor` (Phase 8). Files the `app-audit-refactor` branch changed in its Badge/payout commits
are left for after the merge — editing them here only buys a conflict.

- [x] · fixed · `DUP` · `worker-expenses/worker-expense-drafts-table.tsx`, `worker-reports/worker-report-history-table.tsx`
      · client pagination → `src/hooks/use-client-pagination.ts` + `ui/pagination/client-pagination.tsx`;
      status/investment filters → `src/hooks/use-status-investment-filters.tsx`
- [x] · fixed · `CYCLE` · `forms/hooks/form-hooks.ts` ↔ `forms/form-components/*` · contexts in `forms/hooks/form-context.ts`
- [x] · fixed · `CYCLE` · `ExpenseFormPrefillT` · moved from `expense-form.tsx` to `bulk-expense-form.ts`
- [x] · fixed · `CYCLE` · `lib/i18n/dictionaries/{uk,ru}.ts` · `import type { pl }`
- [x] · fixed · `SIZE` · `forms/expense-form/line-items-field.tsx` 615 → 466 · `row-select.tsx`, `use-receipt-scan.ts`
- [x] · fixed · `DUP` · `edit-transfer-form.tsx`, `settle-payouts-form.tsx` · hand-rolled form shell → `FormShell`
- [x] · fixed · `BUG` · `forms/hooks/use-check-form-errors.ts` · console output gated to development
- [x] · fixed · `DEAD` · `RateFieldNameT`, `RatePlaneValuesT`, `TargetFieldNameT` exports; `PaginationEllipsis`;
      `data as TData[]` cast in `data-table.tsx`; commented-out Roundcube link in `nav/sidebar.tsx`
- [x] · fixed · `DUP` · `deposit-form.tsx` double import; `materials-transactions-table.tsx` double import;
      `handleGenerate` alias in `expense-form.tsx`
- [x] · fixed · `DUP` · `report-grid.tsx` `keepMenuOpen` · `DropdownMenuCheckboxItem` already keeps the menu open
- [x] · fixed · `DUP` · Set toggles in `leads/{lead-assets-dialog,promote-lead-dialog,leads-data-table}.tsx` → `toggleInSet`;
      `PICK_LABEL` shared from `lead-assets-dialog.tsx`
- [x] · fixed · `DUP` · line-item amount sums in `expense-form.tsx` / `paragon-footer.tsx` → `sumLineItemAmounts`
- [x] · fixed · `BUG` · `tables/expense-drafts.tsx` dates · viewer locale passed, as in `tables/worker-reports.tsx`
- [x] · fixed · `BUG` · `dialogs/add-worker-dialog.tsx` · `DEFAULT_LANGUAGE` instead of `'pl'`
- [x] · fixed · `LAYER` · moves: `investments/contract-form.tsx` → `forms/contract-form/`;
      `summary/tabs/margin-*` → `summary/tables/`; `dialogs/{sheet-button,edit-investment-prefill}.tsx` →
      `investments/`; `dashboard/register-balance-chart.tsx` → `cash-registers/`;
      `forms/hooks/use-file-pick-ingest.ts` → `src/hooks/` (non-form consumers); `derived-tone` + `flagged-tone` → `kosztorys/tones.ts`
- [x] · fixed · `TOOL` · `scripts/check-compiler-coverage.mjs` + `pnpm check:compiler` (Phase 7 guard), eslint-ignored like its sibling node scripts
- [x] · skipped · `DUP` · `tables/transfers.tsx` register link cells · file changed on `app-audit-refactor`; after the merge
- [x] · skipped · `LAYER` · `ui/decision-progress-badge.tsx` out of `ui/`, and its tone map shared with
      `collapsible-line-item.tsx` · both changed on `app-audit-refactor` (Badge commit); after the merge
- [x] · skipped · `LAYER` · `settle-payouts-table.tsx` → `tables/` · changed on `app-audit-refactor`; after the merge
- [x] · skipped · `I18N` · hard-coded Polish in `filters/{active-filters-bar,queue-filters}.tsx`, `ui/search-select.tsx`,
      `media/zoomable-preview-image.tsx:97`, `worker-expenses/use-expense-draft-acceptance.tsx` · needs keys in
      `pl/uk/ru.ts`, all three changed on `app-audit-refactor`; after the merge
- [x] · skipped · `DUP` · `filters/filter-select.tsx` vs `ui/search-select.tsx` · triggers and check placement differ;
      sharing the body is a visible-markup refactor that deserves its own review
- [x] · skipped · `DUP` · submit pipeline in `use-paragon-decisions.ts` vs `expense-form.tsx` · the confirm and
      receipt-decision arguments differ; behaviour-sensitive booking path
- [x] · skipped · `SIZE` · `filters/filter-multi-select.tsx` (356 lines) · under the size bar; split is its own refactor
- [x] · skipped · `BEHAV` · `dashboard/user-register-stats.tsx:18` matches registers by owner name; `ownerId` exists ·
      changes what a user sees — surfaced to the owner, not applied
- [x] · skipped · `COPY` · `summary/blocks/subcontractor-summary.tsx:74` „Lista wpłat” over a payouts table · wording
      is the owner's call — surfaced
- [x] · dropped · `DUP` · investment-form address grid (site vs billing) · typed field names; a prefix parameter drops TanStack's name checks
- [x] · dropped · `DUP` · `add-sheet-dialog` / `sheet-setup-dialog` service-account hint · markup differs; the shared part is a 3-line fetch
- [x] · dropped · `DUP` · local `InvestmentOptionT` `{ id; name }` in sheets dialogs · a two-field structural type
- [x] · dropped · `DUP` · `transfer-filters.tsx` eight `FilterMultiSelect` blocks · a config array's entries would be the blocks' props
- [x] · dropped · `DEAD` · unused shadcn kit exports in `ui/{popover,alert-dialog,field,command,select,dialog,calendar,dropdown-menu}.tsx` · vendored kit
- [x] · dropped · `UI` · `ui/signed-money-display.tsx` default „Saldo” label · borderline, no defect
- [x] · dismissed · `DEAD` · `equipment/where-filter-options.ts` `WHERE_UNKNOWN` · a spec imports it
- [x] · dismissed · `TEST` · `account-credentials-schema.ts` static schema · it is `buildSchemas(POLISH_ACCOUNT).form`, the same builder the form calls

## Phase 7 — memo guard and removal (2026-10-19)

Cycles after the phase: 25.

- [x] · fixed · `MEMO` · stripped from 20 of the 23 files: `src/hooks/{use-persisted-value,use-client-multi-filter,
      use-active-filter,use-engaged-ids,create-json-map-store,use-search-filter,use-status-filter,use-optimistic-toggle}.ts`,
      `ui/field.tsx`, `sheets/{investments-without-sheet-table,kosztorys-data-table}.tsx`, `{equipment,fleet,users,
      investments,work-catalogue,cash-registers}/*-table.tsx`, `forms/form-fields/cash-register-field.tsx`,
      `editor/hooks/use-sheet-import.ts`, `editor/dialogs/catalogue/catalogue-compare-dialog.tsx` · `pnpm check:compiler` ok on each
- [x] · fixed · `TEST` · new specs `hooks/{use-persisted-value,use-client-multi-filter,use-engaged-ids,use-optimistic-toggle}.test.tsx`
      (filtered rows, persisted values, optimistic revert) written before the strip
- [x] · skipped · `MEMO` · `use-element-height.ts`, `editor/hooks/use-wrap-column-widths.ts`, `editor/hooks/use-inline-rename.ts` ·
      the callback is a callback ref or an effect dependency; vitest runs without the compiler, and stripping
      `use-inline-rename`'s `close` broke its unmount-commit spec — React keeps `useCallback` as the escape hatch for effect deps
- [x] · dismissed · `TEST` · no spec for the table/field memos (`columns`, options, `getSearchableText`) · stable
      values with no observable effect of their own; the existing table specs and the hook specs cover the rows they feed

## Phase 8 — kosztorys editor split (2026-10-19)

Cycles after the phase: 15 (none in `kosztorys/editor`).

- [x] · fixed · `MEMO` · the React Compiler did not compile `useKosztorysEditor`, `KosztorysEditorV2` or
      `useKosztorysStageOps` before this phase, so their hand-written memos were load-bearing · bailouts fixed
      (ref writes moved into `useLayoutEffect`, try/finally and computed keys removed), memos stripped only after
      `pnpm check:compiler` showed `ok`; `scripts/check-compiler-coverage.mjs` now mirrors Next's SWC prefilter
- [x] · fixed · `SPLIT` · `use-kosztorys-editor.ts` → `hooks/{use-editor-rows,use-undo-bursts,use-section-crud,use-item-ops,
      use-catalogue-ops,use-grid-change-pipeline}.ts`; return shape unchanged
- [x] · fixed · `SPLIT` · `kosztorys-editor-body.tsx` 761 → 541 lines: `hooks/use-row-sizing.ts`, `grid-empty-overlay.tsx`,
      `PreviewHeader` in `preview-header-actions.tsx` · split by concern, not by mode: history/report/preview differ by parameters
- [x] · fixed · `CYCLE` · action hooks moved to `actions/use-*-action(s).ts`, the picker and reorder contexts to
      `actions/{catalogue-picker,reorder-open}.ts` · 25 → 15 cycles
- [x] · skipped · `MEMO` · compiler bails on `hooks/{use-debounced-save,use-external-change-reload,use-kosztorys-settings}.ts`,
      `dialogs/new-item/new-item-form.tsx`, `dialogs/worker-reports/worker-reports-dialog.tsx`,
      `dialogs/catalogue/{add-items-from-catalogue-dialog,save-item-to-catalogue-dialog}.tsx` · none holds a hand
      memo and none is on the grid's render path; rewriting try/finally and ref reads in working code buys nothing measurable
- [x] · skipped · `MEMO` · `use-wrap-column-widths.ts`, `use-inline-rename.ts` keep their `useCallback` · see Phase 7

