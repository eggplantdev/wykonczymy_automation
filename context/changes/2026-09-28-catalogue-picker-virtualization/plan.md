# Catalogue picker virtualization Implementation Plan

## Overview

Virtualize the list in „Dodaj pracę z katalogu" (`AddItemsFromCatalogueDialog`) so it draws the ~20
rows in view instead of the whole cennik (561 prac). The flag-only A/B measured 4–10× faster on every
interaction (see `change.md`); this plan makes that speed-up land **without** the three layout
regressions the flag alone caused. Linear: EX-860.

## Current State Analysis

- The dialog renders every catalogue row through the non-virtualized `DataTable` path inside a
  `max-h-[55vh] overflow-y-auto` wrapper (`add-items-from-catalogue-dialog.tsx:261-265`).
- `DataTable` already has opt-in virtualization (`enableVirtualization`, `virtualRowHeight`,
  `virtualContainerHeight` — `data-table.tsx:46-48,149-155`) rendering through
  `VirtualizedTableBody`. Two consumers use it today: `materials-transactions-table.tsx:239` and
  `subcontractor-payouts-table.tsx:85`.
- `VirtualizedTableBody` (`virtualized-table-body.tsx`):
  - lays out `table-fixed` with a `<colgroup>` of `header.getSize()` widths (`:42-52`) — an unsized
    column falls back to TanStack's uniform 150;
  - **never measures rows**: positions come from `estimateSize` alone, so a row taller than the estimate
    drifts the spacers and the scroll range;
  - takes the container height as a px number applied as `style={{ height }}` (`:46`).
- The picker's columns (`WORK_CATALOGUE_PICKER_COLUMNS`, `src/components/tables/work-catalogue.tsx:189`)
  declare no `size`; the same column objects are shared with /katalog-prac
  (`getWorkCatalogueColumns`), whose table is NOT virtualized.
- Picker rows wrap to ~110 px (long opis, two-line kategoria) against the default estimate of 44.

## Desired End State

Opening the picker, unticking „Ukryj już dodane", typing in the szukajka and ticking a checkbox all
render only the rows in view. Re-measured with the change's script at 4× CPU throttle, every
interaction lands within reach of the flag-only numbers (open ≈ 107 ms, all-561 ≈ 57 ms, keystroke
list ≈ 68 ms) — against today's 412 / 662 / 641 ms. The dialog looks as it does today: „Opis pracy"
takes the width the narrow columns leave, rows of any height scroll without jumps, the list stops at
55vh and shrinks when a search leaves few rows, and the „Dodaj do:" footer stays visible.

### Key Discoveries:

- `materials-transactions-table.tsx:50-52` already documents the silent-drift risk: _"The virtualizer
  estimates from this number and never measures, so drift here is silent"_. Measuring fixes it for
  every consumer at once.
- `materials-transactions-table.tsx:58-59` is the precedent for sizing every column of a virtualized
  table explicitly.
- Neither `TableHeader` nor `DataTableRow` reads `getSize()` — only `VirtualizedTableBody` does — so
  adding `size` to the shared catalogue column defs changes nothing on /katalog-prac.
- `e2e/work-catalogue.spec.ts:212-223` finds the inserted praca by its checkbox in the whole list and
  asserts `toHaveCount(0)` while hidden. Under virtualization a row outside the window is also absent,
  so the assertion turns vacuous and the later `row.click()` can miss a row that sorts past the window.
- `src/hooks/use-search-filter.ts:30` claims the katalog draws „~950" rows; it is 561.

## What We're NOT Doing

- No virtualization of /katalog-prac, `catalogue-diff-table`, `sheet-compare-dialog` /
  `sheet-report-parts` (dropped from EX-860).
- No sticky table header — the header scrolls with the rows today and keeps doing so.
- No change to how the two summary tables compute their container height (`virtualContainerHeight`
  stays their px API).
- No change to selection mechanics (`SelectedIdsContext`) — a row remounted by the virtualizer reads
  the ticked set from context exactly as a row remounted by a search does today.

## Implementation Approach

Fix the shared layer first (measure real rows, let one column fill, accept a class for the scroll
container), then switch the picker onto it. Measuring is on for **every** virtualized table — one
path, and it removes the drift the materials table warns about; the two summary tables get a visual
check for it. Column widths: the narrow columns get fixed sizes, „Opis pracy" is marked `fill` and
takes the rest, with its `size` acting as its floor.

## Critical Implementation Details

**Fill column floor.** In `table-fixed` layout CSS leaves `min-width` on table cells undefined, so the
`min-w-112` meta class on „Opis pracy" cannot be relied on to hold it open. The floor must come from the
table's own `minWidth` — the sum of every column's `getSize()`, the fill column's included — which
`VirtualizedTableBody` already computes (`:43,47`). The fill column's `<col>` simply carries no width.

**Height must be a max, not a height.** The picker's scroll container takes `max-h-[55vh]` (the class
it has today) rather than a fixed height: its content height is the virtualizer's total size, so the
list collapses to a few rows when a search leaves few, exactly as the non-virtualized list does. A
fixed height would leave an empty 55vh box under a three-row result.

**Sizes must fit dialog-xl.** `--container-dialog-xl` is `min(80vw, 75rem)`; minus the list's `px-4`
the table gets ≈1120 px on a 1440-wide screen. Keep the sum of all floors at or under that, so a
common laptop shows no horizontal scroll; narrower screens scroll horizontally, as they do today.
Headers are `whitespace-nowrap` — the two stawka columns' first header line („Stawka z narzędziami")
sets their minimum.

## Phase 1: Shared table layer

### Overview

`VirtualizedTableBody` measures real row heights, supports one fill column, and accepts a class for its
scroll container. The two existing consumers keep their API.

### Changes Required:

#### 1. Row measurement

**File**: `src/components/tables/data-table/virtualized-table-body.tsx`,
`src/components/tables/data-table/data-table-row.tsx`

**Intent**: Every rendered virtual row registers with `virtualizer.measureElement`, so positions and
the scroll range follow real heights; `virtualRowHeight` becomes the initial estimate only.

**Contract**: `DataTableRow` gains two optional props passed through to its `<tr>` — a ref callback and
the row's virtual index (rendered as `data-index`, which `measureElement` reads). The non-virtualized
path passes neither and is unchanged.

#### 2. Fill column

**File**: `src/components/tables/column-meta.ts`, `virtualized-table-body.tsx`

**Intent**: A column may declare that it takes the width the sized columns leave.

**Contract**: `ColumnMeta.fill?: boolean` — honoured by the virtualized `<colgroup>` only (its `<col>`
gets no width); its `size` still counts toward the table's `minWidth` as its floor. Document on the
field that the non-virtualized table ignores it.

#### 3. Scroll container class

**File**: `src/components/tables/data-table/data-table.tsx`, `virtualized-table-body.tsx`

**Intent**: A caller whose list height follows a layout (a dialog) sizes the scroll container with a
class instead of a px number.

**Contract**: `DataTable` gains `virtualContainerClassName?: string`, forwarded to the scroll `<div>`.
When it is set, the `height` style from `virtualContainerHeight` is not applied (the default 600 must
not override the class). Existing callers pass nothing new.

#### 4. Stale comment

**File**: `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:50-52`

**Intent**: The comment says the virtualizer never measures; after this phase it does. Rewrite it to
what stays true: `ROW_HEIGHT` is the estimate the collapsed container height is computed from.

### Success Criteria:

#### Automated Verification:

- DataTable specs pass: `pnpm exec vitest run src/__tests__/components/tables/data-table/`
- Materials table spec passes: `pnpm exec vitest run src/__tests__/components/kosztorys/summary/tables/materials-transactions-table.test.tsx`

#### Manual Verification:

- Kosztorys summary → „Materiały" table: rows, header and „Razem" footer look as before; scrolling a
  long list has no jump or blank band.
- Kosztorys summary → wypłaty podwykonawców table: same check.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: The picker

### Overview

Size the picker's columns, switch its table onto virtualization, add the regression guard, and keep
the E2E meaningful.

### Changes Required:

#### 1. Column sizes

**File**: `src/components/tables/work-catalogue.tsx`

**Intent**: Give every picker column an explicit `size`; mark „Opis pracy" `fill`.

**Contract**: `size` on `descriptionColumn` (its floor), `categoryColumn`, `unitColumn`,
`clientPriceColumn`, `wToolsRateColumn`, `ownToolsRateColumn`; `meta.fill: true` on
`descriptionColumn`. Sizes are the implementer's call within the „Sizes must fit dialog-xl" constraint
above; verify visually. Harmless to /katalog-prac (never reads `getSize()`).

#### 2. Virtualize the dialog list

**File**: `src/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.tsx`

**Intent**: Render the list through the virtualized body, with the scroll container capped at 55vh.

**Contract**: the `select` display column gets a `size` fitting the checkbox; `DataTable` gets
`enableVirtualization`, a `virtualRowHeight` estimate close to a one-line picker row, and
`virtualContainerClassName="max-h-[55vh]"`. The wrapper `<div>` around it drops its own
`max-h-[55vh] overflow-y-auto` (it keeps the padding) — one scroll container, not two.

#### 3. Regression guard

**File**: `src/__tests__/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.test.tsx`

**Intent**: Pin the point of the change: a large cennik renders a window, not every row. Without it,
dropping `enableVirtualization` in a later refactor passes every spec.

**Contract**: render the dialog with a few hundred generated catalogue items and assert the number of
rendered praca checkboxes is well below the item count (jsdom has no layout, so the virtualizer renders
its overscan window — assert a bound, not an exact count). Assert via the rendered checkboxes, not
virtualizer internals.

#### 4. E2E finds the row through the szukajka

**File**: `e2e/work-catalogue.spec.ts:210-223`

**Intent**: Under virtualization a row outside the window is absent from the DOM, so the
„hidden by the switch" assertion becomes vacuous and the click can miss. Type the praca's name into
„Szukaj pracy…" first — the owner's own way to find a row — so the list holds at most that praca and
both the `toHaveCount(0)` and the click are about the switch again.

**Contract**: fill the szukajka with `seed.insert.item` before locating `row`; keep the existing
instrument-check comment accurate.

#### 5. Stale count

**File**: `src/hooks/use-search-filter.ts:30`

**Intent**: „~950 unvirtualized rows" → the real size (~560). The rationale stays: /katalog-prac still
draws its cennik unvirtualized.

### Success Criteria:

#### Automated Verification:

- Picker dialog specs pass, including the new window-bound guard: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.test.tsx`

#### Manual Verification:

- „Dodaj pracę z katalogu" at a 1440-wide window: „Opis pracy" is the widest column, no column is
  clipped, no horizontal scroll; the „Dodaj do:" footer is fully visible.
- Scroll the whole list top to bottom and back: no jumps, no blank bands, wrapped rows fully visible.
- Tick a praca, scroll it out of view and back: it is still ticked, and „Dodaj (1)" never changed.
- A search leaving 2–3 rows: the list shrinks to them (no empty 55vh box).
- Run `pnpm exec playwright test e2e/work-catalogue.spec.ts` against the E2E DB (human-triggered —
  the agent does not run E2E unprompted).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Re-measure

### Overview

Prove the target on the finished change with the same instrument that produced the baseline.

### Changes Required:

#### 1. Measurement run

**File**: `context/changes/2026-09-28-catalogue-picker-virtualization/measure-picker.js` (already in
the change folder), results appended to `change.md`

**Intent**: Run the script against a production build (`pnpm build` + `next start -p 3100`, inv 157)
through Playwright's `browser_run_code` (copy it under `.playwright-mcp/` — the tool only loads files
from there), and record the 1× / 4× medians next to the baseline in `change.md`.

**Contract**: same script, same investment, same build mode as the baseline — otherwise the numbers do
not compare. Target at 4×: each figure within ~1.5× of the flag-only column.

### Success Criteria:

#### Automated Verification:

- None phase-scoped — the measurement is a scripted browser run recorded by hand.

#### Manual Verification:

- 4× numbers recorded in `change.md` and each within ~1.5× of the flag-only column (open ≈ 107 ms,
  all-561 ≈ 57 ms, keystroke list ≈ 68 ms).

---

## Testing Strategy

### Unit Tests:

- Window-bound guard in the dialog's DOM spec (Phase 2.3).
- Existing DataTable and materials-table specs as the regression net for the shared layer.

### Integration Tests:

- `e2e/work-catalogue.spec.ts` covers the picker end to end (dialog → akcja → Postgres → grid); Phase
  2.4 keeps it valid under virtualization.

### Manual Testing Steps:

1. Open „Dodaj pracę z katalogu" on a large kosztorys, untick „Ukryj już dodane", scroll the whole list.
2. Tick a row, scroll it away and back, then add — it lands in the chosen sekcja.
3. Check both summary tables for unchanged layout and smooth scrolling.

## Performance Considerations

`measureElement` attaches a `ResizeObserver` per rendered row — ~20–30 rows at a time, negligible
against 561 rendered rows. Measured heights make scrolling up through variable-height rows adjust the
scroll offset; TanStack handles that by default.

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full suite passes: `pnpm test`
- Build succeeds: `pnpm build`

## References

- Change notes + baseline: `context/changes/2026-09-28-catalogue-picker-virtualization/change.md`
- Measurement script: `context/changes/2026-09-28-catalogue-picker-virtualization/measure-picker.js`
- Sized-columns precedent: `src/components/kosztorys/summary/tables/materials-transactions-table.tsx:58`
- Linear: EX-860

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared table layer

#### Automated

- [x] 1.1 DataTable specs pass
- [x] 1.2 Materials table spec passes

### Phase 2: The picker

#### Automated

- [ ] 2.1 Picker dialog specs pass, including the new window-bound guard

### Phase 3: Re-measure
