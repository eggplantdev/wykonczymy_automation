# Kosztorys column values — single source Implementation Plan

## Overview

Every computed kosztorys column (`plannedNet`, `donePercent`, `remaining`, `net`, `discountAmount`,
per-etap values, …) has its per-row figure composed independently on four surfaces — the grid cell,
the sort key, the section/„Razem" totals, and the two PDF prints. Nothing forces them to agree, and
they have drifted twice: EX-487 (sort read a non-existent row field) and EX-894 (sort reads the active
`view` while the cell is pinned to `'client'`). This change introduces one resolver that owns each
computed column's per-row value, makes all four surfaces read it, and pins the equality with parity
specs so a third drift fails a test instead of reaching the owner.

## Current State Analysis

- **Grid cells** — `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:90-417`
  (`assembleV2Columns`) passes an inline `compute` closure to `computedColumn(id, title, compute, …)`
  for every computed column. It memoises `totalQtyDone` per row in a `WeakMap` (`:151-166`).
- **Sort keys** — `src/lib/kosztorys/sort-value.ts:58-137` (`columnSortValue`) re-composes the same
  figures in a `switch`. Its own header comment admits the duplication ("composes the figure the same
  way its column renderer does").
- **Totals** — `src/lib/kosztorys/column-totals.ts:45-102` (`columnTotalsForRows`) re-composes
  `plannedNet` / `net` / `discount` / `remaining` / `remainingForPlane` per row and sums them; per-etap
  values come from `stageAxisForView` (`settlement-aggregates.ts:40-64`).
- **Prints** — `src/lib/kosztorys/print/offer-columns.ts` and `print/worker-columns.ts` (plus
  `print/columns.ts` `stageNetValue`) re-compose them a fourth time and format the result.

### The EX-894 defect

Commit `3400f9b2` (2026-09-23, owner ruling) made „Wartość przedmiaru netto", „% wykonania" and
„Pozostało netto" visible in the crew views, always read at the client price over the whole offered
scope. It removed them from `PRZEDMIAR_ANCHORED_COLUMNS` (`column-config.ts:89-92`) and pinned the
totals (`column-totals.ts:67`) — but not the sort keys:

| Column        | Cell           | Sort key (`sort-value.ts`)                    | Wrong in a crew view |
| ------------- | -------------- | --------------------------------------------- | -------------------- |
| `plannedNet`  | `'client'`     | `rowPlannedNetForView(row, view)` `:106`      | yes                  |
| `donePercent` | `'client'` qty | `rowTotalQtyDone(row, stages, view)` `:121`   | yes                  |
| `remaining`   | `'client'`     | `rowRemainingForView(row, stages, view)` `:124` | yes                |
| `plannedGross`, `remainingGross` | `'client'` | `view` | unreachable today (hidden outside client; `reconcileSort` drops the sort) |

The comment at `kosztorys-v2-columns.tsx:299-301` still justifies the `'client'` pin by
`PRZEDMIAR_ANCHORED_COLUMNS` dropping these columns — no longer true since `3400f9b2`.

## Desired End State

- `src/lib/kosztorys/column-values.ts` is the only place a computed column's per-row value is composed.
- Grid cells, `columnSortValue`, `columnTotalsForRows` and both print column builders obtain the
  per-row value from it; they keep only their own concern (formatting, tone, summation, null-sinking).
- In a crew view, sorting by `plannedNet` / `donePercent` / `remaining` follows the displayed numbers.
- A parity spec builds the real grid in every view and surface and asserts sort key === cell value
  for every computed column it assembles; a second spec asserts each summed total === Σ its cells.
- No displayed number, total or printed figure changes.

### Key Discoveries:

- `rowTotalQtyDone` applies `stagesForView` itself (`sort-value.ts:31-33` comment), so passing the full
  `stages` vs the view's stages yields the same figure — the resolver can take full `stages`.
- `row-view.ts:126` builds `getValue` once per sort call — the natural place to create one resolver
  per sort, so its memo lives exactly as long as the sort.
- The worker surface is read-only (`use-kosztorys-editor.ts:383,528` `editorOnly(setSortField)`), so
  `remainingForPlane` has no sort today; the resolver still serves it (cell, totals, print) when
  `executedQtyByItem` is in the context.
- Subcontractor price/coeff/source columns and `price` are **editable** cells with their own display
  path and already share their primitive with the sort (`viewPrice`, `shownCoeff`, `priceSourceOf`,
  `calc.ts:165`). They stay out of the resolver.
- `divergence` is computed from `measureDiscrepancy(row, stages)`; the cell reads the whole object,
  the sort reads `.net` — the resolver owns the numeric `.net` for sorting only if the cell's display
  object remains `measureDiscrepancy`; keep it out of the resolver (its cell is a bespoke
  `divergenceColumn`, not `computedColumn`) and leave its sort case as is.

## What We're NOT Doing

- Changing any figure's meaning or any displayed/printed number. Pure unification + the EX-894 fix.
- Folding the editable columns (`price`, subcontractor price/coeff/source, discount value/type,
  stage qty, `plannedQty`) into the resolver — they have no computed per-row composition to drift.
- Replacing `stageAxisForView` in totals — it prices each row once for all etapy (perf); it is covered
  by the totals parity spec instead.
- Adding sort to the worker surface.
- `settlement-aggregates.ts` section subtotals / summary panel, `sheet-import`, `history/diff-versions`
  — they compute domain aggregates, not a grid column's cell.

## Implementation Approach

A resolver factory, not a flat map: some values need context (stages, view, the worker's
`executedQtyByItem`) and a per-row memo of `totalQtyDone`. Each surface creates one resolver per pass
(one grid assembly, one sort, one totals call, one print) and asks it for the compute function of a
column id. Stage-value ids are template keys (`stageValueNetKey(id)`), resolved by parsing, the same
way `sort-value.ts` does today.

## Critical Implementation Details

- **Performance** — the grid's per-row `totalQtyDone` memo (`kosztorys-v2-columns.tsx:162-166`) is
  load-bearing: 2×|etapy| stage-value cells per row would otherwise make a row O(|etapy|²). The
  resolver must keep that memo (row identity as `WeakMap` key, as today), and the grid must create the
  resolver once per `assembleV2Columns` call, not per column. A kosztorys can hold 1000+ rows.
- **Stage-value denominator** — the per-etap value divides by Σ etapów of the whole VIEW, never the
  engaged-condition-narrowed `shownStages` (`kosztorys-v2-columns.tsx:144-147`). The resolver takes
  the full `stages`; narrowing stays in the grid's choice of which columns to assemble.
- **Out-of-view etap** — the sort returns `null` for a stage-value id whose etap the view does not
  price (`sort-value.ts:40`); the resolver keeps that rule so the sort still sinks it.
- **Parallel work in `src/lib/kosztorys/print/`** — another agent is mid-rename (`offer-print/` →
  `print/`, new `offer-columns.ts` / `build-html.ts` / `document-rows.ts`, uncommitted at planning
  time). Phase 4 starts only once `git status --short src/lib/kosztorys/print src/__tests__/lib/kosztorys/print`
  is clean; until then stop after Phase 3 and report.

## Phase 1: Resolver + sort (TDD)

### Overview

Red spec for EX-894 first, then the resolver, then `columnSortValue` reads it.

### Changes Required:

#### 1. EX-894 regression spec (write first, must fail)

**File**: `src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts`

**Intent**: In a crew view (`'w_tools'` and `'own_tools'`), sorting by `plannedNet`, `donePercent`
and `remaining` must order rows by the value their cell displays (the `'client'` reading). Needs rows
whose client price and crew price order them oppositely, and an etap on the other crew's plane so
`donePercent` differs between the full and the crew-filtered pomiar.

**Contract**: `columnSortValue(row, field, view, stages)` for those fields equals the `'client'`
reading in every view. Also assert `plannedGross` / `remainingGross` follow `'client'`.

#### 2. Resolver module

**File**: `src/lib/kosztorys/column-values.ts` (new)

**Intent**: The single home of every computed column's per-row value.

**Contract**:

```ts
export type ColumnValueCtxT = {
  stages: KosztorysStageT[]
  view: PriceViewT
  executedQtyByItem?: Record<number, number>
}
export type ColumnValueT = (row: KosztorysV2RowT) => number | null
// undefined = not a computed column (a row field, an editable column) — the caller falls back.
export function columnValueResolver(ctx: ColumnValueCtxT): (field: string) => ColumnValueT | undefined
```

Covers: `stageQtySum`, `priceGross`, `discountAmount`, `discountAmountGross`, `plannedNet`,
`plannedGross`, `plannedNetForPlane`, `net`, `gross`, `donePercent`, `remaining`, `remainingGross`,
`remainingForPlane` (only when `executedQtyByItem` is present), stage-value net/gross keys. Pins
`'client'` exactly where the grid cells pin it today. Holds the per-row `totalQtyDone` memo.

#### 3. Sort reads the resolver

**File**: `src/lib/kosztorys/sort-value.ts`, `src/lib/kosztorys/row-view.ts`

**Intent**: `columnSortValue` asks the resolver first; only non-computed ids fall through to the
plane-price namespace, `divergence`, and the row-field default. The computed `switch` cases and
`stageValueNetSortValue` go. `row-view.ts` builds one resolver per sort.

**Contract**: `columnSortValue` takes the resolver (or builds one from `view` + `stages`) — pick the
signature that keeps `row-view.ts`'s single call site building it once per sort. Header comment
rewritten to say the value comes from `column-values.ts`.

### Success Criteria:

#### Automated Verification:

- EX-894 spec fails before step 2–3, passes after: `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts`
- Resolver unit spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/column-values.test.ts`
- Existing sort specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-view-sort-within-sections.test.ts src/__tests__/lib/kosztorys/row-view-sort-scope.test.ts`

#### Manual Verification:

- In „Z narzędziami" and „Bez narzędzi", sorting by „Wartość przedmiaru netto", „% wykonania" and „Pozostało netto" (rosnąco and malejąco) orders rows by the numbers shown in those columns
- In „Inwestor", sorting by every computed column behaves as before

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Grid cells read the resolver + parity spec

### Overview

`assembleV2Columns` stops writing compute closures; each computed column takes its value from the
resolver. A parity spec makes drift between cell and sort a test failure.

### Changes Required:

#### 1. Grid assembly

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: One resolver per assembly (`{ stages, view, executedQtyByItem: opts.workerSurface?.executedQtyByItem }`);
every computed column's `compute` — and the `remaining` / `remainingForPlane` tones — come from it.
The local `memoisedByRow` `totalQtyDone` moves into the resolver (the `divergence` memo stays local).
A computed column id missing from the resolver must be impossible to ship silently — throw at assembly
(or type it) rather than render a blank.

**Contract**: rewrite the stale comment at `:299-301`: the pin is the owner's 2026-09-23 ruling
(przedmiar figures read at the client price over the whole offered scope in every view), not
`PRZEDMIAR_ANCHORED_COLUMNS`.

#### 2. Cell ↔ sort parity spec

**File**: `src/__tests__/components/kosztorys/editor/grid/column-value-parity.test.ts` (new)

**Intent**: For each view (`client`, `w_tools`, `own_tools`) and the worker surface, build the real
column set via `buildV2Columns`, and for every assembled column whose `component` is the computed
cell, assert `columnData.compute(row) === columnSortValue(row, id, …)` across a fixture with mixed
prices, a rabat, an overrun row and an other-plane etap. Iterating the ASSEMBLED columns (not a
hand-kept list) is the point: a new computed column is covered the day it is added.

### Success Criteria:

#### Automated Verification:

- Parity spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/column-value-parity.test.ts`
- Existing grid column specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/`

#### Manual Verification:

- Every computed column shows the same numbers as before the change in all three views (spot-check a seeded kosztorys, `INV=6`)
- „Pozostało netto"/„Pozostało brutto" still turn red on the overrun rows, and only there
- Editor stays responsive on the ~1000-row perf kosztorys (`INV=7`): scrolling and typing in an etap feel unchanged

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Totals read the resolver

### Overview

`columnTotalsForRows` sums the resolver's per-row values instead of re-composing them.

### Changes Required:

#### 1. Totals

**File**: `src/lib/kosztorys/column-totals.ts`

**Intent**: One resolver per call; `plannedNet`, `plannedNetForPlane`, `net`, `discountAmount`,
`remaining`, `remainingForPlane` accumulate `resolver(id)(row)`. The overrun skip on the two
„Pozostało" totals stays (`isRemainingOverrun`). Brutto totals keep `toGross(netTotal, vatRate)` of the
netto total (unchanged). Per-etap totals stay on `stageAxisForView`. The docblock keeps its rationale;
drop the "Pinned to 'client' like the cells" inline comment — the pin now lives in one place.

#### 2. Totals parity spec

**File**: `src/__tests__/lib/kosztorys/column-totals.test.ts`

**Intent**: For each view, every summed netto total equals Σ of its column's resolver values over the
rows (for „Pozostało", Σ over non-overrun rows), and each per-etap total equals Σ of that etap's cell
values — so `stageAxisForView` is pinned to the cells too.

### Success Criteria:

#### Automated Verification:

- Totals specs pass: `pnpm exec vitest run src/__tests__/lib/kosztorys/column-totals.test.ts`
- Client-document subtotals unaffected: `pnpm exec vitest run src/__tests__/lib/kosztorys/client-document-subtotals.test.ts`

#### Manual Verification:

- Section footers and „Razem" show the same figures as before on a seeded kosztorys, in all three views
- On the worker surface, „Pozostało" total matches the sum of its non-red rows

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Prints read the resolver

### Overview

Offer and worker print columns take their numbers from the resolver and keep only formatting.
**Gate:** start only when `src/lib/kosztorys/print/` has no uncommitted changes from the parallel
restructure (see Critical Implementation Details); re-read those files fresh before editing.

### Changes Required:

#### 1. Print column builders

**Files**: `src/lib/kosztorys/print/offer-columns.ts`, `src/lib/kosztorys/print/worker-columns.ts`,
`src/lib/kosztorys/print/columns.ts`

**Intent**: Each computed print column formats `resolver(key)(row)`; the resolver is built from the
print's own `view` and `printStages` (and `executedQtyByItem` on the worker print). `stageNetValue`
goes. The offer keeps `OFFER_PRICE_VIEW` as the view it passes; formatting (`zloty`, `formatPLN`,
`formatPercent`, blank for an etap with no qty) is unchanged.

**Contract**: `PrintColumnT['cell']` signature unchanged unless threading the resolver through it is
cleaner than building one per cell call — if built per call, the memo buys nothing but the result
is still correct; prefer one per print pass.

### Success Criteria:

#### Automated Verification:

- Print specs pass unchanged: `pnpm exec vitest run src/__tests__/lib/kosztorys/print/`

#### Manual Verification:

- Offer PDF („Drukuj ofertę") of a seeded kosztorys shows the same figures as before in every column
- Worker PDF for each crew shows the same figures as before, incl. „Pozostało"

**Implementation Note**: Final phase — aggregate the manual verification bullets into `context/foundation/manual-checks.md`.

---

## Testing Strategy

### Unit Tests:

- EX-894 regression (Phase 1): crew-view sort order == displayed order for the three pinned columns.
- `column-values.test.ts`: `'client'` pin on przedmiar figures in every view; `null` for an
  out-of-view etap; `undefined` for non-computed ids; `remainingForPlane` only with `executedQtyByItem`.
- Parity (Phase 2): every assembled computed column, every view/surface, cell === sort.
- Totals parity (Phase 3): total === Σ cells.

### Manual Testing Steps:

1. `INV=6` seeded kosztorys, „Z narzędziami": sort by „Wartość przedmiaru netto" desc — the column's numbers read top-down descending. Repeat for „% wykonania", „Pozostało netto", and in „Bez narzędzi".
2. Same kosztorys, all three views: compare section footers, „Razem" and a few cells against a pre-change screenshot.
3. Print the offer and one worker document; compare against pre-change PDFs.
4. `INV=7` (1000 rows): scroll and type — no perceptible slowdown.

## Performance Considerations

Resolver memo keyed by row identity keeps the grid's per-row `totalQtyDone` cost identical. One
resolver per sort replaces per-compare recomputation of `rowTotalQtyDone` in the sort path — a small
win on large kosztorysy.

## Whole-tree Gate

Run **once**, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`

## References

- Linear: EX-894 (this), EX-487 (first drift), EX-885 (where EX-894 was found)
- Owner ruling commit: `3400f9b2`
- Sort: `src/lib/kosztorys/sort-value.ts`; grid: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`; totals: `src/lib/kosztorys/column-totals.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Resolver + sort (TDD)

#### Automated

- [x] 1.1 EX-894 spec fails before step 2–3, passes after — efcebbc6
- [x] 1.2 Resolver unit spec passes — efcebbc6
- [x] 1.3 Existing sort specs pass — efcebbc6

### Phase 2: Grid cells read the resolver + parity spec

#### Automated

- [x] 2.1 Parity spec passes — 3b9c1f4a
- [x] 2.2 Existing grid column specs pass — 3b9c1f4a

### Phase 3: Totals read the resolver

#### Automated

- [x] 3.1 Totals specs pass — 680fab1a
- [x] 3.2 Client-document subtotals unaffected — 680fab1a

### Phase 4: Prints read the resolver

#### Automated

- [ ] 4.1 Print specs pass unchanged
