# Owner-set column order for the investor and worker documents (EX-884) — Implementation Plan

## Overview

The owner sets the column order of both closed documents from their settings windows. The investor
document is the podgląd, the `/k/[token]` link and „Generuj ofertę”. The worker document is the
worker link, Podgląd pracownika and the worker PDF. Screen and paper keep reading one list per
audience, so both follow the stored order by construction. „Opis prac” is pinned: always first, and
no longer uncheckable. That also closes the PDF section-total misplacement for good.

## Current State Analysis

- Each audience has one fixed document list: `CLIENT_DOCUMENT_COLUMNS` (`src/lib/kosztorys/column-config.ts:241-262`)
  and `WORKER_DOCUMENT_COLUMNS` (`:292-303`, the logical `rate` key mapped per plane by
  `workerDocumentColumns`, `src/lib/kosztorys/worker-view/settings.ts:75-79`). Three consumers
  iterate them:
  - the grid: `documentOrder` → `orderAssembled` (`src/components/kosztorys/editor/grid/column-selection.ts:82-86,184-197`);
  - the offer PDF: `offerPrintColumns` → `printableKeys(CLIENT_DOCUMENT_COLUMNS, hidden)` (`src/lib/kosztorys/offer-print/columns.ts:261-283`);
  - the worker PDF: `workerPrintColumns` (`src/lib/kosztorys/offer-print/worker-columns.ts:42-86`).
- Settings are `{ hiddenColumns, hideEmptyRows }`. Investor settings are stored per investment in
  `kosztorys-client-view`, with a firm fallback in the `kosztorys-client-view-defaults` global, and
  the investment's own row wins as a whole (`src/lib/queries/kosztorys-client-view.ts:46-59`).
  Worker settings are one firm-wide global, `kosztorys-worker-view-settings`. Both sanitizers fail
  closed against their ceiling.
- The only order store today is the workbench's per-browser localStorage map (`use-column-order.ts`,
  `opts.columnRanks`). Closed surfaces deliberately ignore it, and `worker-columns.test.ts:107-117`
  pins that. The ruling of 2026-07-28 applies: a per-browser order must never shape a client document.
- The PDF section total (`build-offer-print-html.ts:144-167`, shared by both prints through
  `buildKosztorysPrintHtml`) places the label in the cells left of the money column. When nothing is
  left of it (`moneyIndex === 0`), `Math.max(1, …)` puts the label in cell 0 and the figure one
  column right, under the wrong heading. This is reachable today by unchecking „Opis prac” and every
  column before the money column.
- The investor settings dialog fetches through `readClientViewSettings` (`src/lib/queries/client-view-settings-endpoint.ts`).
  Two callers: `investor-actions.tsx:53` and `offer-print-action.tsx:94`.

## Desired End State

- Both settings windows have a „Ustaw kolejność kolumn…” button. It opens the drag window
  (`ColumnOrderDialog`) over the settings window. The order becomes part of the settings draft and is
  written only by that window's „Zapisz”.
- The saved order drives the investor document (podgląd, `/k/[token]`, offer PDF) and the worker
  document (link, Podgląd pracownika, worker PDF). Screen and paper always agree.
- „Opis prac” is always first and always visible, on both documents and both PDFs. Its checkbox shows
  checked and disabled, and it is not in the drag list.
- Investor window: „Przywróć domyślną kolejność” restores the firm-wide order, or the built-in order
  when the firm default has none. Worker window: it restores the built-in order. Either takes effect
  on „Zapisz”.
- The workbench and the owner's own editor keep reading the per-browser order. No closed surface
  reads it.
- Verification: the unit, DOM and print specs listed per phase pass, and the manual checks below
  hold on a local investment.

### Key Discoveries

- `orderColumnKeys(keys, ranks)` (`src/lib/table/column-order.ts`) treats a missing rank as its
  index. So `rankForMove` must be fed `baseRanks` built from the SAME list the ordering function
  sorts: the document list minus „Opis prac”. Built off the full list, every drag lands one slot off.
- `ViewSettingsFields` hard-codes `ViewSettingsValueT = { hiddenColumns, hideEmptyRows }`
  (`dialogs/view-settings-fields.tsx:7`). Its `{ ...value, … }` spreads keep extra fields at runtime
  but the type drops them, so it must become generic over the settings shape.
- `ColumnOrderDialog` (`src/components/ui/column-order-dialog.tsx`) owns its own `Dialog`. The reset
  button is disabled when `ranks` is empty. That is wrong for an investment whose reset target is a
  non-empty firm order, so the disable rule must become a prop.
- Locally, 0 of 11 stored settings rows hide `description` (docker 5433, checked 2026-09-28), so the
  pin changes no existing document.
- Next serialises client-invoked server actions, so a second endpoint "in parallel" for the firm order
  would be a second round trip. Extend the one read instead.

## What We're NOT Doing

- No per-browser order on any closed surface, and no change to the workbench's order store or menu.
- No fallback split between order and ticks: the investment's row wins as a whole, order included
  (plan decision).
- No change to which columns MAY appear (ceilings), to the „Wartości” money figure the section total
  sums, or to the summary block under the rozpiska.
- No reorder of stage columns within their family: a stage family moves as one block, as today.
- No E2E authored here. The browser-level risk (owner reorders → saves → link and PDF follow) is owed
  at the review gate, authored or filed as `e2e-backlog`.
- No touch to EX-886's DROP of the old variant columns. That migration must land after ours and stay
  separate.

## Implementation Approach

The order is data on the existing settings rows. It is sanitized with the same fail-closed discipline
as the ticks, though an order cannot disclose anything: a bad rank is simply dropped. One pure ordering
rule per audience replaces the bare constant at all three consumers, so screen and paper cannot drift.
„Opis prac” is enforced in two places: the ordering rule forces it first, and the sanitizer never lets
it be hidden. Every consumer inherits both. The UI reuses the workbench's drag window, fed by the
settings draft.

## Critical Implementation Details

**State sequencing.** The drag window is fed from the settings window's draft, not from saved
settings. Its `onSetRank` / `onReset` write into that draft. A drag-then-„Zamknij” on the order window
followed by closing the settings window without „Zapisz” must leave the saved order untouched,
consistent with that window's „nothing is written until Zapisz” contract (`kosztorys-client-view-dialog.tsx:21-22`).

**Deploy order.** The migration is additive: three nullable `jsonb` columns. A human runs
`pnpm db:migrate:prod` before the push that ships the code. `investor-change-history` owns
`20260928_3`, so this one is `20260928_4`. Re-check `src/migrations/` at implementation time in case
another agent claimed `_4`.

## Phase 1: Storage and rules

### Overview

Persist the order and give each audience one ordering rule with „Opis prac” pinned. No UI or
consumer change yet.

### Changes Required

#### 1. Migration

**File**: `src/migrations/20260928_4_document_column_ranks.ts` (+ register in `src/migrations/index.ts`)

**Intent**: Add a nullable `column_ranks jsonb` column to `kosztorys_client_view`,
`kosztorys_client_view_defaults` and `kosztorys_worker_view_settings`. Hand-written, in the style of
`20260928_2`.

**Contract**: No default, no backfill: NULL means "never ordered" and resolves to the built-in order.
Use `ADD COLUMN IF NOT EXISTS`, and let `down` drop all three.

#### 2. Payload fields

**Files**: `src/collections/kosztorys-client-view.ts`, `src/globals/kosztorys-client-view-defaults.ts`,
`src/globals/kosztorys-worker-view-settings.ts`

**Intent**: Add a `columnRanks` field of type `json` beside `hiddenColumns` on all three, with no
`defaultValue`. Regenerate types with `pnpm generate:types` (gitignored, never staged).

#### 3. Pinned key and ordering rule

**Files**: `src/lib/kosztorys/column-config.ts`, new `src/lib/kosztorys/document-column-order.ts`

**Intent**: Name the pinned column once, as a `DOCUMENT_PINNED_COLUMN = 'description'` constant beside
the document lists. Add a pure `orderDocumentKeys(keys, ranks)`: the pinned key first when present,
then the rest through `orderColumnKeys`. Add a `documentBaseRanks(keys)` that builds base ranks over
the same "rest" list, so the drag window and the rule agree on what an unranked column's index is.

**Contract**: `orderDocumentKeys(keys: readonly string[], ranks: ColumnRanksT): string[]` ignores any
rank stored for the pinned key. `documentBaseRanks(keys: readonly string[]): ColumnRanksT`.

#### 4. Settings types and sanitizers

**Files**: `src/lib/kosztorys/client-view-settings.ts`, `src/lib/kosztorys/worker-view/settings.ts`

**Intent**: Add `columnRanks: ColumnRanksT` to `ClientViewSettingsT` and `WorkerViewSettingsT`. Each
sanitizer keeps only finite ranks (`dropNonFiniteRanks`) keyed inside its own ceiling, never the
pinned key, and returns `{}` for a missing or non-object value. Both sanitizers also drop the pinned
key from `hiddenColumns`. Add `clientDocumentColumns(ranks)` and change `workerDocumentColumns(plane)`
to `workerDocumentColumns(plane, ranks)`. The worker orders its logical keys (the `rate` rank is
stored under `rate`) BEFORE mapping `rate` to `price__<plane>`, so one firm-wide rank serves both
rozliczenia.

**Contract**: The client ceiling is `PREVIEW_VISIBLE_COLUMNS` and the worker ceiling is
`WORKER_VIEW_KEYS`. The client's fail-closed fallback for a non-array `hiddenColumns` is unchanged.
`WORKER_VIEW_DEFAULT_SETTINGS` gains `columnRanks: {}`.

#### 5. Unit specs

**Files**: `src/__tests__/lib/kosztorys/client-view-settings.test.ts`,
`src/__tests__/lib/kosztorys/worker-view/settings.test.ts`, new
`src/__tests__/lib/kosztorys/document-column-order.test.ts`

**Intent**:
- Sanitize: a rank outside the ceiling, a rank on the pinned key, a non-finite rank and a non-object
  map are all dropped; a stored `'description'` in `hiddenColumns` is dropped.
- Ordering: the pinned column stays first even when it is ranked last; a stage group moves as one
  key; the worker `rate` rank reorders `price__<plane>` on both planes.
- Update the existing whole-object equality assertions and literal fixtures that now miss
  `columnRanks`: `kosztorys-client-view.test.ts:63,88,94,100` and `worker-view/settings.test.ts:38,51`.

### Success Criteria

#### Automated Verification

- The migration applies to local 5433 and to the 5435 test DB: `pnpm payload migrate`
- The new and updated unit specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/client-view-settings.test.ts src/__tests__/lib/kosztorys/worker-view/settings.test.ts src/__tests__/lib/kosztorys/document-column-order.test.ts`
- The DB-backed resolver spec passes with the new field: `pnpm exec vitest run src/__tests__/lib/queries/kosztorys-client-view.test.ts`

#### Manual Verification

- In `/admin`, the three records show a `columnRanks` field that is empty for existing rows, and every
  document still renders in today's order.

---

## Phase 2: Documents follow the order

### Overview

All three consumers read the stored order. The dialog's read returns the firm order for „Przywróć”.

### Changes Required

#### 1. Grid consumers

**Files**: `src/components/kosztorys/editor/grid/kosztorys-v2-column-opts.ts`,
`src/components/kosztorys/editor/grid/column-selection.ts`,
`src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Carry the stored ranks as a field distinct from the per-browser `columnRanks`: a
`previewColumnRanks` beside `previewHiddenColumns`, and `columnRanks` inside `workerSurface`.
`documentOrder` returns `clientDocumentColumns(opts.previewColumnRanks ?? {})` /
`workerDocumentColumns(plane, workerSurface.columnRanks)`. `columnOpts` fills them from
`clientView.columnRanks` / `worker.settings.columnRanks`.

**Contract**: The per-browser `opts.columnRanks` stays ignored on every closed surface, so the
existing `worker-columns.test.ts:107-117` keeps passing unchanged. Edit only the `columnOpts` and
`previewHiddenColumns` lines. `investor-change-history` phase 5 edits the neighbouring
`use-kosztorys-editor.ts:501-507`, so re-read the file before editing.

#### 2. Print consumers

**Files**: `src/lib/kosztorys/offer-print/columns.ts`,
`src/lib/kosztorys/offer-print/build-offer-print-html.ts`,
`src/lib/kosztorys/offer-print/worker-columns.ts`,
`src/lib/kosztorys/offer-print/build-worker-print-html.ts`

**Intent**:
- `offerPrintColumns` takes the ranks and prints `printableKeys(clientDocumentColumns(ranks), hidden)`,
  fed `settings.columnRanks` by `buildOfferPrintHtml`.
- `workerPrintColumns` takes `columnRanks` and iterates `workerDocumentColumns(plane, columnRanks)`,
  fed `worker.settings.columnRanks`.
- In `buildKosztorysPrintHtml`, keep the `Math.max(1, moneyIndex)` guard. Rewrite its comment to the
  current reason: „Opis prac” is pinned first on both documents, so the money column always has a
  label cell on its left. The guard only protects `colspan="0"` from a future caller whose list
  pins nothing.

#### 3. Dialog read returns the firm order

**Files**: `src/lib/queries/kosztorys-client-view.ts`,
`src/lib/queries/client-view-settings-endpoint.ts`,
`src/components/kosztorys/editor/actions/investor-actions.tsx`,
`src/components/kosztorys/editor/actions/offer-print-action.tsx`

**Intent**: The resolver's two reads already fetch the firm global. Expose both answers from them: the
effective settings (row ?? defaults ?? code default, unchanged for the preview and token entrances)
and the firm order (`sanitize(defaults ?? {}).columnRanks`). `readClientViewSettings` returns both.
`investor-actions` keeps the firm order in its own state, exposed as `defaultColumnRanks`.
`offer-print-action` reads `.settings`.

**Contract**: `readClientViewSettings(investmentId): Promise<{ settings: ClientViewSettingsT; defaultColumnRanks: ColumnRanksT }>`.
`getClientViewSettings` keeps its signature. Update the endpoint mocks in `investor-actions.test.tsx`
and `offer-print-action.test.tsx`.

#### 4. Consumer specs

**Files**: `src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts`,
`src/__tests__/components/kosztorys/editor/grid/worker-columns.test.ts`,
`src/__tests__/lib/kosztorys/offer-print/build-offer-print-html.test.ts`,
`src/__tests__/lib/kosztorys/offer-print/worker-print.test.ts` (paths as they exist)

**Intent**:
- The stored ranks reorder the preview grid and the worker grid.
- A ranked-last „Opis prac” still renders first.
- The offer and worker prints follow the same ranks in the same order as their grid.
- Money column moved to right after „Opis prac”: the „Razem — <sekcja>” figure sits in the money
  column's cell index, on both prints. This extends `build-offer-print-html.test.ts:254-277` with a
  placement assertion.
- Update literal settings fixtures missing `columnRanks`: `offer-print-action.test.tsx:90`,
  `use-kosztorys-view-state.test.tsx:82`, `kosztorys-client-view-defaults.test.ts:26`,
  `kosztorys-workers-menu.test.tsx:37`, `build-offer-print-html.test.ts:49-57`,
  `worker-print.test.ts:69`, plus the `workerSurface` literals in `remaining-overrun-tone.test.ts:44`
  and `preview-columns.test.ts:146`.

### Success Criteria

#### Automated Verification

- The grid and print specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/preview-columns.test.ts src/__tests__/components/kosztorys/editor/grid/worker-columns.test.ts` plus the two print specs
- The endpoint consumers' DOM specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/actions/investor-actions.test.tsx src/__tests__/components/kosztorys/editor/actions/offer-print-action.test.tsx`

#### Manual Verification

- A `columnRanks` value edited by hand in `/admin` for one investment reorders its podgląd, its
  `/k/[token]` link and its „Generuj ofertę” PDF identically.
- The same on the worker global reorders a worker link, Podgląd pracownika and the worker PDF, on both
  rozliczenia (z narzędziami / bez narzędzi).

---

## Phase 3: Settings windows

### Overview

The owner edits the order where they edit the ticks.

### Changes Required

#### 1. Generic fields with the pinned tick

**File**: `src/components/kosztorys/editor/dialogs/view-settings-fields.tsx`

**Intent**: Make the component generic over `T extends ViewSettingsValueT`, so `columnRanks` survives
`onChange` in the type as well as at runtime. Render the `DOCUMENT_PINNED_COLUMN` checkbox as checked
and disabled.

#### 2. Order window entry, investor

**Files**: `src/components/kosztorys/editor/dialogs/kosztorys-client-view-dialog.tsx` (and/or
`client-view-settings-form.tsx`)

**Intent**: Add a „Ustaw kolejność kolumn…” button that opens `ColumnOrderDialog` over the settings
window.
- Items: `clientDocumentColumns(draft.columnRanks)` minus the pinned key, labelled from
  `COLUMN_LABELS`, with `visible` from the draft's ticks (hidden columns stay draggable, greyed).
- `baseRanks`: `documentBaseRanks(CLIENT_DOCUMENT_COLUMNS)`.
- `onSetRank`: merges into `draft.columnRanks`.
- `onReset`: sets `draft.columnRanks = defaultColumnRanks`.
- Description: „Opis prac” always comes first, and the order is saved with „Zapisz”.
- The `saveClientViewDefaultsAction` path already carries the whole draft, so „Zapisz jako domyślne”
  saves the order as the firm order too.

#### 3. Order window entry, worker

**File**: `src/components/kosztorys/editor/dialogs/kosztorys-worker-view-dialog.tsx`

**Intent**: Same button over the worker's lists: `WORKER_DOCUMENT_COLUMNS` logical keys, labelled with
`workerColumnLabel`. `onReset` sets `{}`, the built-in order. The button is disabled when `!mayWrite`,
like the ticks.

#### 4. Reset rule as a prop

**File**: `src/components/ui/column-order-dialog.tsx`

**Intent**: Add an optional `resetDisabled?: boolean`. It defaults to today's
`Object.keys(ranks).length === 0`, so the workbench's behaviour is unchanged. The settings windows
pass "the draft's effective order already equals the reset target's order", comparing
`orderDocumentKeys` outputs rather than rank maps, because two different maps can give one order.

#### 5. DOM specs

**Files**: new `src/__tests__/components/kosztorys/editor/dialogs/kosztorys-client-view-dialog.test.tsx`,
`src/__tests__/components/kosztorys/editor/toolbar/kosztorys-workers-menu.test.tsx` (existing worker
dialog coverage, path as it exists)

**Intent**:
- Investor: „Opis prac” is checked and disabled.
- The button opens the order window, whose list omits „Opis prac”.
- Reset restores the firm order in the list.
- „Zapisz” sends the draft's `columnRanks` to `saveClientViewSettingsAction` (mocked, asserted on its
  argument).
- Closing without „Zapisz” calls nothing.
- Worker: the button is disabled for a manager, and reset restores the built-in order.
- Drags go through `rankForMove` + the `onSetRank` path in the style of
  `data-table-column-order.test.tsx:27-35`, not through synthetic pointer drags.

### Success Criteria

#### Automated Verification

- The new and updated dialog specs pass: `pnpm exec vitest run --project dom src/__tests__/components/kosztorys/editor/dialogs/kosztorys-client-view-dialog.test.tsx` plus the workers-menu spec
- The workbench order window's existing specs pass unchanged: `pnpm exec vitest run src/__tests__/components/tables/data-table/data-table-column-order.test.tsx` (path as it exists)

#### Manual Verification

- Investor: drag „Wartość netto przedmiaru” to right after „Opis prac” and „Zapisz”. The podgląd, the
  `/k/[token]` link and „Generuj ofertę” all show the new order, and the section's „Razem” sits under
  „Wartość netto przedmiaru”.
- Investor: „Przywróć domyślną kolejność” on an investment with its own order returns it to the firm
  order after „Zapisz jako domyślne” was used from another investment. With no firm order it returns
  to the built-in one.
- Investor: drag, close the order window, close settings without „Zapisz”. The documents are unchanged.
- Worker: reorder, „Zapisz”. Every worker link and PDF follows. A manager sees the button disabled.
- The workbench's own „Ustaw kolejność kolumn…” (per-browser) still works and does not affect any
  document.

---

## Testing Strategy

### Unit Tests

- Sanitize (ranks and the pinned tick), the ordering rule (pin, stage block, worker `rate` mapping),
  print column order and section-total placement.

### Integration Tests

- `kosztorys-client-view.test.ts` (DB-backed resolver): add one roundtrip where a saved row's
  `columnRanks` comes back from `getClientViewSettings` and the firm order comes back from the dialog
  read. Assert the persisted value, not the action's return.

### Manual Testing Steps

1. The Phase 3 manual checks, on a local investment with a filled kosztorys (`seed-kosztorys.ts`).
2. Print both PDFs after reordering and compare the column order to the screen.

## Migration Notes

`20260928_4` is additive, so a human applies it to prod with `pnpm db:migrate:prod` **before** the
push that ships the code. Existing rows get NULL and read as the built-in order. EX-886's future DROP
on the same client-view tables is a separate, later migration.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit and DOM suite passes: `pnpm test`
- DB integration suite passes: `pnpm test:integration`

## References

- Research: `context/changes/2026-09-28-document-column-order/research.md`
- One-list-per-audience commit: `170d5586`
- Workbench order window and its ranks: `src/components/ui/column-order-dialog.tsx`, `src/lib/table/column-order.ts`
- Additive migration pattern: `src/migrations/20260928_2_client_view_single_set.ts`

## Addendum — 2026-09-28: no brutto on the investor document

Owner ruling after p3, landed in `7a986a1b`: the investor's document carries no gross column at all —
`plannedGross`, `priceGross`, `discountAmountGross`, `gross`, the per-etap gross value and
`remainingGross` left `CLIENT_VIEW_GROUPS` (so `PREVIEW_VISIBLE_COLUMNS`), `CLIENT_DOCUMENT_COLUMNS`,
the print column map and the settlement totals. A stored gross tick or rank fails closed in the
sanitizers. Outside the plan's scope; recorded here so the diff is not read as drift.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Storage and rules

#### Automated

- [x] 1.1 Migration applies to local 5433 and to the 5435 test DB — ff966895
- [x] 1.2 New and updated unit specs pass (sanitize, ordering rule) — ff966895
- [x] 1.3 DB-backed resolver spec passes with the new field — ff966895

### Phase 2: Documents follow the order

#### Automated

- [x] 2.1 Grid and print specs pass — 96e43151
- [x] 2.2 Endpoint consumers' DOM specs pass — 96e43151

### Phase 3: Settings windows

#### Automated

- [x] 3.1 New and updated dialog specs pass — c20e7eaa
- [x] 3.2 Workbench order window's existing specs pass unchanged — c20e7eaa
