# Kosztorys Progress Percentages Implementation Plan

## Overview

Add progress percentages to the kosztorys v2 editor: a values ↔ percent display toggle for the per-stage value columns (percent mode replaces the netto/brutto stage value pairs with a single % column per stage), an always-available per-row "% wykonania" column, a whole-kosztorys progress counter in the toolbar, and per-section done % in the section summary panel.

## Current State Analysis

- The editor renders stage progress three ways today: editable stage qty columns (`stage_<id>`), computed per-stage value netto (`stageValueNet_<id>`) and brutto (`stageValueGross_<id>`) columns — all assembled in `assembleV2Columns` (`src/lib/tables/kosztorys-v2-columns.tsx:532-685`), filtered by picker visibility + money axis in `buildV2Columns` (`:698-707`).
- The `kosztorys-netto-brutto-select` change (just shipped on this branch) established the display-axis pattern this feature copies: axis model (`src/lib/kosztorys/money-axis.ts`), tag maps in `src/lib/kosztorys/constants.ts` (`COLUMN_MONEY_AXIS`), a global localStorage `useSyncExternalStore` hook (`src/components/kosztorys/use-money-axis.ts`), and a `ToggleGroup` in the toolbar (`src/components/kosztorys/kosztorys-editor-toolbar.tsx:122-135`).
- Percent math primitives exist: `stageValueForView` (`src/lib/kosztorys/calc.ts:98-106`) computes a stage's value as its qty share of the row net; `rowDoneNetForView` (`src/lib/kosztorys/v2-rows.ts:317-326`) sums completed-stage values; `sectionSubtotalsForView` (`calc.ts:122-146`) already computes a percent-of-whole (`share`).
- There is NO done/progress figure anywhere yet — no row %, no section done %, no kosztorys counter. The sheet has no per-stage or progress sums either (verified in `context/reference/kosztorys-editor-domain-notes.md`), so nothing here is sheet parity — these are new figures.
- `formatNet` (`src/lib/kosztorys/format.ts`) is the only grid number format; no percent formatter exists (section share inlines `(share * 100).toFixed(1)`).

### Key Discoveries:

- A stage's % is the same number under netto and brutto (and independent of the price view): `stageValue / rowNet = qtyDone / measuredQty` by construction (`calc.ts:105`). So percent mode needs ONE % column per stage, and the fractions can be computed purely from quantities.
- Exception: when `measuredQty === 0`, `stageValueForView` falls back to `qtyDone × price` (`calc.ts:103-104`) and the fraction has no denominator — these rows render "—" in percent columns.
- The group/toggleKey machinery (`constants.ts:56-75`, `kosztorys-v2-columns.tsx:690-696`) is built for exactly this: a fourth stage column group (`stageValuePercent`) slots in beside `stageValueNet`/`stageValueGross`. None of the group names prefixes another, so `toggleKey`'s `startsWith` tests stay unambiguous.
- Visibility already composes as `pickerAllows AND axisAllows` (`buildV2Columns:701-704`); the progress display becomes a third AND-ed predicate, same shape as `axisAllows` (fail-open for untagged columns).
- `stageKey` lives in `v2-rows.ts`, which imports `calc.ts` — so done-net aggregation helpers that need stage keys go in `v2-rows.ts` (not `calc.ts`) to avoid an import cycle.
- Aggregates ignore filter/sort by design (`use-kosztorys-editor.ts:171-174` computes `subtotals`/`totalNet` from full `rows`) — the counter and section done % follow the same rule.
- Never add a remount `key` to `DynamicDataSheetGrid` — a changing column set needs no remount and a `key` reintroduces the EX-422 flicker (`context/foundation/lessons.md`).

## Desired End State

- The toolbar has a third `ToggleGroup`: **Kwoty / % wykonania**. In percent mode, the per-stage netto/brutto value columns disappear and one "% wykonania" column per stage appears (read-only, integer percent, "—" when `measuredQty === 0`, >100% shown as-is). Values mode is today's behavior exactly.
- A "% wykonania" row column (overall row done %) is in the column picker, visible by default in both modes.
- The toolbar shows a whole-kosztorys counter: `Wykonano: 74,6% · 12 400,00 / 16 620,00` — percent at 1 decimal, values via `formatNet`, brutto when the money axis is `gross`, netto otherwise; respects the active price view; computed over the full dataset (ignores search/section filter).
- Each section row in the summary panel additionally shows its done % (1 decimal, same tooltip pattern as the existing share %).
- The toggle persists globally in localStorage and survives reloads; the money axis and column picker keep working unchanged in both modes.

Verify by: unit tests green, `pnpm typecheck` + `pnpm lint` green, and a manual pass in the editor (toggle both modes, hide/show columns, switch axis + price view, check a `measuredQty = 0` row and an overshoot row).

## What We're NOT Doing

- No schema/DB/migration changes — everything is computed from existing inputs.
- No sorting for the new % columns (sort stays wired only for price/net/remaining).
- No editing via % (stage qty inputs stay qty-only, untouched in percent mode).
- No progress in the print/export path.
- No per-stage sum row ("ile zapłacić za etap" — roadmap question 12b, separate decision).
- No clamping or warning styles for >100% — the raw number is the signal.
- No plan-vs-actual panel work (that is slice F's scope).

## Implementation Approach

Copy the `kosztorys-netto-brutto-select` architecture wholesale: a pure display-mode model (`progress-display.ts`) + tag map in `constants.ts` + global localStorage hook (`use-progress-display.ts`) + a third AND-ed predicate in `buildV2Columns` + a `ToggleGroup` in the toolbar. New math is quantity-based fractions (view-independent) in `calc.ts`, and done-net aggregation (view-dependent, needs stage keys) in `v2-rows.ts`. UI consumes them in three places: grid columns, toolbar counter, section summary.

Phase 1 is pure lib + tests (TDD-able, no UI). Phase 2 makes the grid react to the mode. Phase 3 adds the toolbar control, counter, and summary %.

## Phase 1: Percent math, display-mode model, formatters (no UI)

### Overview

All pure logic: the progress-display axis model and predicate, fraction helpers with 0-denominator guards, done-net aggregations, and percent formatters — each unit-tested.

### Changes Required:

#### 1. Progress display model

**File**: `src/lib/kosztorys/progress-display.ts` (new)

**Intent**: The values/percent axis as a model, mirroring `money-axis.ts` — a type, a default, and a fail-open visibility predicate.

**Contract**: `ProgressDisplayT = 'values' | 'percent'`; `PROGRESS_DISPLAY_DEFAULT: ProgressDisplayT = 'values'`; `progressDisplayAllows(toggleKey: string, display: ProgressDisplayT): boolean` — hides `stageValuePercent` in values mode and `stageValueNet`/`stageValueGross` in percent mode, `true` for any untagged key (fail-open like `axisAllows`, `money-axis.ts:12-17`).

#### 2. Tag map + column group constants

**File**: `src/lib/kosztorys/constants.ts`

**Intent**: Declare the fourth stage column group and which display mode each stage-value group belongs to, keeping the tag data beside `COLUMN_MONEY_AXIS`.

**Contract**: `STAGE_VALUE_PERCENT_COLUMN_GROUP = 'stageValuePercent'`; `stageValuePercentKey(stageId)` → `stageValuePercent_<id>` (same non-`stage_`-prefix reasoning as `stageValueNetKey`, `constants.ts:63-75`); `COLUMN_PROGRESS_DISPLAY: Record<string, ProgressDisplayT>` tagging the three stage-value groups (`stageValueNet`/`stageValueGross` → `'values'`, `stageValuePercent` → `'percent'`); `COLUMN_LABELS` entries: `stageValuePercent: 'Etapy — % wykonania'`, `donePercent: '% wykonania'`. Do NOT add either to `DEFAULT_HIDDEN_COLUMNS` (both default visible). The `stageValuePercent` group is NOT in `COLUMN_MONEY_AXIS` (axis-neutral, fails open).

#### 3. Fraction helpers

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: Quantity-based fractions with explicit no-denominator signaling, so render code never divides.

**Contract**: `stageDoneFraction(row: ViewPricingT, qtyDoneInStage: number): number | null` — `qtyDone / measuredQty`, `null` when `measuredQty === 0`; no clamping (overshoot > 1 passes through). `rowDoneFraction(row: ViewPricingT, totalQtyDone: number): number | null` — same shape for the row total. (Both view-independent by the share construction; documented as such.)

#### 4. Done-net aggregations

**File**: `src/lib/kosztorys/v2-rows.ts`

**Intent**: The counter's and summary's numerators — Σ of completed-stage values at the view's price, whole-kosztorys and per-section. Lives here (not `calc.ts`) because it needs `stageKey`/`KosztorysStageT`, avoiding a calc→v2-rows import cycle.

**Contract**: `kosztorysDoneNetForView(rows, stages, view): number` — Σ `rowDoneNetForView` over all rows; `sectionDoneNetForView(rows, stages, view): Map<number, number>` — the same keyed by `sectionId`. Also `rowTotalQtyDone(row, stages): number` — Σ of the row's `stage_<id>` values, the input to `rowDoneFraction`.

#### 5. Percent formatters

**File**: `src/lib/kosztorys/format.ts`

**Intent**: Two percent formats — dense integer for grid cells, 1-decimal for the counter and section rows — plus the shared "—" for null fractions.

**Contract**: `formatPercent(fraction: number | null): string` → `'75%'` / `'—'`; `formatPercentPrecise(fraction: number | null): string` → `'74,6%'` (pl-PL comma) / `'—'`. Input is a fraction (0.746), not points.

#### 6. Unit tests

**File**: `src/__tests__/kosztorys-progress-display.test.ts` (new), extend `src/__tests__/kosztorys-calc.test.ts`, `src/__tests__/kosztorys-v2-rows.test.ts`

**Intent**: Pin the predicate (both modes × tagged/untagged keys, mirroring `kosztorys-money-axis.test.ts`), the fraction guards (`measuredQty === 0` → null, overshoot passes through, discount does not skew the fraction), the aggregations (empty kosztorys, sparse stage keys), and the formatters (rounding, comma, null → dash).

**Contract**: `pnpm exec vitest run` on the touched files.

### Success Criteria:

#### Automated Verification:

- New/extended unit tests pass: `pnpm exec vitest run src/__tests__/kosztorys-progress-display.test.ts src/__tests__/kosztorys-calc.test.ts src/__tests__/kosztorys-v2-rows.test.ts`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- None — no UI in this phase.

---

## Phase 2: Grid columns react to the display mode

### Overview

The per-stage % column group, the per-row "% wykonania" column, the localStorage hook, and the third visibility predicate in `buildV2Columns` — after this phase the mode is switchable in code (hook default flips), with the toolbar control still to come.

### Changes Required:

#### 1. Display-mode hook

**File**: `src/components/kosztorys/use-progress-display.ts` (new)

**Intent**: Global localStorage persistence of the mode — a reading preference of the person, not of one kosztorys.

**Contract**: `useProgressDisplay(): [ProgressDisplayT, (d: ProgressDisplayT) => void]`, storage key `'table-columns:kosztorys-progress-display'` (the `table-columns:` family, same reasoning as `use-money-axis.ts:6-12`). Mirror `use-money-axis.ts` verbatim in shape: `useSyncExternalStore`, module-level listener set, validated read, default on SSR.

#### 2. Percent-capable computed column rendering

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: `computedColumn` (`:205-219`) hardcodes `fmt` and a `number` compute; percent columns need `number | null` computes rendered through `formatPercent` with "—" for null.

**Contract**: Extend `computedColumn` with an optional format parameter (default `fmt`) and a `number | null` compute (null → '—'), or add a sibling helper — implementer's choice; existing call sites stay untouched.

#### 3. Stage % column group + row done % column

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: The new columns in the registry: one % column per stage (replacing the value pairs in percent mode) and the always-available row done % column.

**Contract**: In `assembleV2Columns`: `stageValuePercentCols` — per stage, id `stageValuePercentKey(st.id)`, header via `stageValueHeader(st, '%', <tip>)`, compute `stageDoneFraction(r, r[qtyKey] ?? 0)`, placed in the same slot as the value groups (between `computed` and `remaining`, `:675-684`); `donePercent` — single column, id `'donePercent'`, title via `title(...)` + a `HEADER_TIPS.donePercent` entry (Polish: overall row completion, quantity-based, view-independent), compute `rowDoneFraction(r, rowTotalQtyDone(r, stages))`, placed immediately before the `remaining` block. `toggleKey` (`:690-696`) gets a `stageValuePercent_` branch collapsing to the group.

#### 4. Third visibility predicate

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`, `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Visibility becomes `pickerAllows AND axisAllows AND progressDisplayAllows`; the mode flows in through `columnOpts` like `moneyAxis`.

**Contract**: `BuildV2ColumnsOptsT` gains `progressDisplay?: ProgressDisplayT`; the filter in `buildV2Columns` (`:701-704`) ANDs `progressDisplayAllows(key, opts.progressDisplay ?? PROGRESS_DISPLAY_DEFAULT)`. `useKosztorysEditor` calls `useProgressDisplay()` beside `useMoneyAxis()` (`use-kosztorys-editor.ts:113`), adds it to `columnOpts` (`:140-149`), and returns `progressDisplay` / `setProgressDisplay`. `buildV2ToggleItems` needs no change — it iterates the unfiltered registry, so 'Etapy — % wykonania' appears in the picker in both modes (same as axis-hidden columns; picker state and mode compose, never contradict).

### Success Criteria:

#### Automated Verification:

- Full unit suite passes: `pnpm test`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- With the hook default temporarily flipped to `'percent'` (or localStorage edited): stage value netto/brutto columns disappear, one % column per stage appears, values elsewhere unchanged.
- "% wykonania" row column visible by default in both modes; hideable via the picker.
- A row with `measuredQty = 0` renders "—" in all % cells; a row with qtyDone > measuredQty renders >100% literally.
- No grid flicker/remount when switching modes (EX-422 class).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Toolbar toggle + progress counter + section done %

### Overview

The user-facing controls: the values/percent `ToggleGroup`, the whole-kosztorys counter in the toolbar, and per-section done % in the summary panel.

### Changes Required:

#### 1. Toolbar toggle

**File**: `src/components/kosztorys/kosztorys-editor-toolbar.tsx`

**Intent**: A third segmented control beside the price-view and money-axis groups, same `SimpleTooltip` legend pattern.

**Contract**: `PROGRESS_DISPLAYS` options (`{ value: 'values', label: 'Kwoty' }`, `{ value: 'percent', label: '% wykonania' }`) + a Polish legend explaining what percent mode swaps; new props `progressDisplay` / `onProgressDisplayChange` threaded from `kosztorys-editor-body.tsx` (beside `moneyAxis`, `:73-74`).

#### 2. Progress counter

**File**: `src/components/kosztorys/kosztorys-progress-counter.tsx` (new), `src/components/kosztorys/kosztorys-editor-toolbar.tsx`, `src/components/kosztorys/use-kosztorys-editor.ts`, `src/components/kosztorys/kosztorys-editor-body.tsx`

**Intent**: The whole-kosztorys headline: `Wykonano: 74,6% · 12 400,00 / 16 620,00`, always visible while scrolling.

**Contract**: `useKosztorysEditor` memoizes `doneNet = kosztorysDoneNetForView(rows, stages, view)` beside `totalNet` (`:171-174`, full dataset — ignores search/section filter) and returns it. New `KosztorysProgressCounter` component takes `doneNet`, `totalNet`, `vatRate`, `moneyAxis`; renders percent via `formatPercentPrecise(totalNet > 0 ? doneNet / totalNet : null)` and the value pair via `formatNet` — brutto (`toGross`) when `moneyAxis === 'gross'`, netto otherwise (percent is identical either way; VAT is one rate). `tabular-nums`, muted, with a `SimpleTooltip` stating it covers the whole kosztorys at the active price view regardless of filters. Placed in the toolbar's `ml-auto` cluster (`:153`) before the actions menu.

#### 3. Section done %

**File**: `src/components/kosztorys/kosztorys-section-summary.tsx`, `src/components/kosztorys/use-kosztorys-editor.ts`, `src/components/kosztorys/kosztorys-editor-body.tsx`

**Intent**: Each section row also answers "how far along is this section" next to its existing share %.

**Contract**: Hook memoizes `sectionDoneNet = sectionDoneNetForView(rows, stages, view)` and passes it to the summary as a new prop (`Map<number, number>`; `SectionSubtotalT` stays untouched). The section meta line (`:134-145`) extends to `{itemCount} poz. · {share%} · wyk. {done%}` where done% = `formatPercentPrecise(s.net > 0 ? doneNet / s.net : null)`; tooltip text extended to explain both percents.

### Success Criteria:

#### Automated Verification:

- Full unit suite passes: `pnpm test`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- Toggle switches modes instantly, persists across reload (localStorage), independent of the money axis and price view toggles.
- Counter shows sensible percent + values; switches netto→brutto with the axis; unaffected by search/section filter; empty kosztorys shows "—".
- Section rows show done % consistent with their rows' progress; a section with no value shows "—".
- Percent figures agree across surfaces (row %, section %, counter) for a simple hand-checkable dataset (e.g. seeded INV=6).
- No layout breakage in the toolbar at narrow widths (flex-wrap row).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- `progressDisplayAllows`: both modes × the three tagged groups × an untagged key (fail-open) — mirror `kosztorys-money-axis.test.ts`.
- `stageDoneFraction` / `rowDoneFraction`: normal share, `measuredQty === 0` → null, overshoot > 1 un-clamped, discount doesn't skew the fraction.
- `kosztorysDoneNetForView` / `sectionDoneNetForView` / `rowTotalQtyDone`: empty rows, sparse `stage_<id>` keys, multi-section grouping.
- Formatters: rounding to integer/1-decimal, pl-PL comma, null → '—'.

### Integration Tests:

- None at the Vitest layer (column assembly is exercised indirectly; the composition risk is browser-level).

### Browser E2E:

- This is a browser-level slice — per AGENTS.md it owes an E2E (toggle → column set changes → counter visible) authored at the review gate, or deferred to the `e2e-backlog` Linear label with the issue id recorded.

### Manual Testing Steps:

1. Open a seeded kosztorys (`INV=6` seed), toggle Kwoty ↔ % wykonania, verify column swap and persistence after reload.
2. Cross-check one row by hand: qtyDone/pomiar per stage vs the % cells, row % = Σ qtyDone / pomiar, section % and counter consistent.
3. Set a row's pomiar to 0 → "—" everywhere for that row; enter qtyDone > pomiar → >100% shown raw.
4. Switch money axis and price view in percent mode — % figures unchanged, counter values follow the axis.
5. Hide "Etapy — % wykonania" and "% wykonania" via the picker in percent mode — picker wins.

## Performance Considerations

`doneNet`/`sectionDoneNet` are O(rows × stages) reductions memoized on `[rows, stages, view]` — same cost class as the existing `subtotals` memo; fine at the 1000-row scale. Per-cell fraction computes are no heavier than the existing stage value computes.

## Migration Notes

None — no schema or stored-data changes. The new localStorage key is self-initializing (missing/invalid → `'values'`).

## References

- Template change: `context/changes/kosztorys-netto-brutto-select/` (axis model + toolbar control pattern)
- Column registry: `src/lib/tables/kosztorys-v2-columns.tsx:532-707`
- Calc single-source: `src/lib/kosztorys/calc.ts`
- Domain notes: `context/reference/kosztorys-editor-domain-notes.md`
- EX-422 remount lesson: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Percent math, display-mode model, formatters (no UI)

#### Automated

- [x] 1.1 New/extended unit tests pass: `pnpm exec vitest run src/__tests__/kosztorys-progress-display.test.ts src/__tests__/kosztorys-calc.test.ts src/__tests__/kosztorys-v2-rows.test.ts`
- [x] 1.2 Type checking passes: `pnpm typecheck`
- [x] 1.3 Linting passes: `pnpm lint`

### Phase 2: Grid columns react to the display mode

#### Automated

- [ ] 2.1 Full unit suite passes: `pnpm test`
- [ ] 2.2 Type checking passes: `pnpm typecheck`
- [ ] 2.3 Linting passes: `pnpm lint`

### Phase 3: Toolbar toggle + progress counter + section done %

#### Automated

- [ ] 3.1 Full unit suite passes: `pnpm test`
- [ ] 3.2 Type checking passes: `pnpm typecheck`
- [ ] 3.3 Linting passes: `pnpm lint`
