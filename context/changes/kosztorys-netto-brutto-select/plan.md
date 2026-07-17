# Netto / brutto / both select — Implementation Plan

## Overview

A `Netto | Brutto | Oba` control in the kosztorys editor toolbar that narrows which money columns
render. Of the 22 columns in `COLUMN_LABELS`, 12 carry a netto/brutto axis and 10 are neutral; `price`
is exempt by owner decision, so the control moves **11 columns**. It composes with — never replaces —
the existing column picker:

    visible(col) = pickerAllows(col) AND axisAllows(col)

## Current State Analysis

The grid already has every hook this change needs; nothing new is invented.

- **One filter line owns visibility.** `buildV2Columns` (`kosztorys-v2-columns.tsx:694-699`) is
  `assembleV2Columns(opts).filter((c) => !opts.isHidden?.(toggleKey(c.id ?? '')))`. The axis test is a
  second predicate on that same line. `assembleV2Columns` stays the single registry of what exists.
- **`toggleKey` already collapses the stage namespace** (`:686-692`): `stageValueNet_7` →
  `stageValueNet`. So the axis map keys by **toggleKey**, not by column id — 12 static entries, not
  12 + 2×`stages.length`. This is what keeps stage ids out of the axis map, preserving the ghost-id
  property `DEFAULT_HIDDEN_COLUMNS` and the three picker groups were built for.
- **The netto/brutto bijection is exact.** Netto (6): `price`, `discountAmount`, `plannedNet`, `net`,
  `remaining`, `stageValueNet`. Brutto (6): `priceGross`, `discountAmountGross`, `plannedGross`,
  `gross`, `remainingGross`, `stageValueGross`. Neutral (10): `sectionName`, `description`,
  `plannedQty`, `measuredQty`, `unit`, `priceMode`, `priceCoeff`, `discountType`, `discountValue`,
  `stages`. **Correction to the shaping's census:** `COLUMN_LABELS` holds **22** keys, not 21, so the
  split is **6 / 6 / 10**, not 6/6/9. The load-bearing number — 12 tagged, `price` exempt, 11 moved —
  is unaffected; only the neutral tail was miscounted.
- **Two localStorage hooks to copy from.** `useHiddenColumns` (global, `useSyncExternalStore`, sparse
  map) and `usePriceView` (per-investment, single scalar). The axis is **global** (owner decision 3),
  and it is a single scalar, so it borrows `usePriceView`'s shape with `useHiddenColumns`' global key.
- **The toolbar already renders one reading axis.** `KosztorysEditorToolbar` (`:96-102`) wraps
  `ToggleGroup` for `VIEWS` in a `SimpleTooltip` legend. The new control is the same primitive,
  adjacent.

## Desired End State

The toolbar carries `Netto | Brutto | Oba` beside the price-view control. Picking `Netto` drops the
six brutto columns from the grid; `Brutto` drops the five non-exempt netto columns; `Oba` restores
what the picker allows. `Cena j.m. netto` never leaves the screen in any mode. The choice survives a
reload and applies to all three price views. The column picker's menu is byte-for-byte unchanged, and
the Sekcje panel's `Suma netto` / `Suma brutto` both stay put regardless of the mode.

### Key Discoveries:

- `buildV2ToggleItems` (`kosztorys-v2-columns.tsx:703-709`) reads only `NON_HIDEABLE_COLUMNS` and
  `opts.isHidden`. Decision 2 means it is **not touched** — the picker keeps answering only its own
  question.
- `sectionSubtotalsForView` (`calc.ts:122`) returns `net` only; the footer's brutto is
  `grandNet * (1 + vatRate)` inline at `kosztorys-section-summary.tsx:230`. Owner decision:
  **footer untouched** — so calc and the summary component are entirely out of this plan.
- `DEFAULT_HIDDEN_COLUMNS` (`constants.ts:84`, one entry: `stageValueGross`) **survives unchanged**.
  Under AND-composition it is a picker-layer default the axis then narrows further; the two never
  contradict.
- The grid is the reactive `DynamicDataSheetGrid` (`kosztorys-editor-body.tsx:7`). A changing column
  set needs **no remount `key`** — adding one back is EX-422's flicker (`lessons.md:119-135`,
  `ee497cb`).

## What We're NOT Doing

- **Not touching the column picker.** No greying, no "hidden by mode" annotation, no dropped entries.
  A picker-allowed column that the axis hides stays checked in the menu.
- **Not touching the footer** (`Suma netto` / `Suma brutto`) or `sectionSubtotalsForView`.
- **Not touching `price` / `Cena j.m. netto`** — exempt, always rendered.
- **No per-view memory.** One global setting across `client` / `w_tools` / `own_tools`.
- **No write-transform, no VAT round-trip, no rounding decision.** The 11 moved columns are all
  `computedColumn` (read-only) — the mode only decides what is on screen.
- **No migration.** The setting is localStorage-only; an absent key means `oba`.
- **Not making the select a guarantee.** It only narrows: picker-hidden `Brutto` + mode `brutto`
  renders nothing. Correct by the model; flagged for dogfooding, not for code.

## Implementation Approach

Add a third, orthogonal predicate to the one filter line that already decides column visibility, fed
by a global localStorage scalar and driven by a toolbar `ToggleGroup`. The axis is declared as static
data keyed by `toggleKey`, next to `COLUMN_LABELS` — so a new money column is tagged in the same file
where it is named, and an untagged column is neutral by default (fail-open: a forgotten tag shows the
column, never hides it).

## Critical Implementation Details

**Fail-open, and why the exemption is a separate set.** `axisAllows` returns `true` for any key absent
from `COLUMN_MONEY_AXIS`. That makes "neutral" the default and a forgotten tag a visible column rather
than a vanished one. `price` is deliberately **tagged `net` AND listed in the exemption set** rather
than left untagged: it _is_ a netto figure (its label says so, and a later owner may reverse the
exemption), so recording it as neutral would be a lie in the data. The exemption is a policy on top of
the tag, mirroring how `NON_HIDEABLE_COLUMNS` sits on top of `COLUMN_LABELS`.

## Phase 1: The axis as a model (no UI)

### Overview

Everything except the control: the tag map, the exemption, the storage hook, and the second predicate
in the filter. Testable end-to-end without a browser, since `buildV2Columns` is a pure function.

### Changes Required:

#### 1. Axis declaration

**File**: `src/lib/kosztorys/constants.ts`

**Intent**: Declare which columns carry a netto/brutto axis, and which one is exempt from the mode.
Lives beside `COLUMN_LABELS` so a money column is named and tagged in one place.

**Contract**: `COLUMN_MONEY_AXIS: Record<string, 'net' | 'gross'>` — keyed by **toggleKey**
(`stageValueNet`, not `stageValueNet_7`), 12 entries: the six netto and six brutto columns listed in
Current State Analysis. Plus `AXIS_EXEMPT_COLUMNS: ReadonlySet<string>` = `{ 'price' }`, shaped like
the neighbouring `NON_HIDEABLE_COLUMNS`.

#### 2. The axis type and predicate

**File**: `src/lib/kosztorys/money-axis.ts` (new)

**Intent**: The mode type and the single function that answers "does this mode allow this column",
so the rule has one home and the columns file imports a predicate rather than reimplementing it.

**Contract**:

- `export type MoneyAxisT = 'net' | 'gross' | 'both'`
- `export const MONEY_AXIS_DEFAULT: MoneyAxisT = 'both'`
- `export function axisAllows(toggleKey: string, axis: MoneyAxisT): boolean` — `true` when `axis` is
  `both`, when the key is exempt, or when the key is absent from `COLUMN_MONEY_AXIS`; otherwise
  `COLUMN_MONEY_AXIS[key] === axis`.

#### 3. Persistence

**File**: `src/components/kosztorys/use-money-axis.ts` (new)

**Intent**: Persist the mode globally in localStorage, matching the grid's sibling hooks so the
editor has one storage idiom rather than three.

**Contract**: `export function useMoneyAxis(): [MoneyAxisT, (axis: MoneyAxisT) => void]`.
`useSyncExternalStore` over a module-level listener set; server snapshot and first client snapshot
both `MONEY_AXIS_DEFAULT` (no hydration mismatch, no post-hydration flash). Storage key
`table-columns:kosztorys-axis` — the `table-columns:` family, because this is a "which columns do I
want" preference and should clear with them. Unrecognized stored values fall back to the default
(`usePriceView`'s `VALID_VIEWS` guard is the precedent).

#### 4. The second predicate

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Compose the axis into the existing visibility filter. The picker's answer is unchanged;
the axis narrows it further.

**Contract**: `BuildV2ColumnsOptsT` gains `moneyAxis?: MoneyAxisT` (optional, defaulting to `both`, so
every existing caller and test keeps compiling and behaving). `buildV2Columns`' filter becomes a
conjunction over the same `toggleKey(c.id ?? '')`: not hidden **and** axis-allowed.
`buildV2ToggleItems` is **not** touched.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- New axis specs pass: `pnpm exec vitest run src/__tests__/kosztorys-money-axis.test.ts`
- The existing kosztorys suites still pass: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts src/__tests__/kosztorys-v2-rows.test.ts src/__tests__/kosztorys-column-widths.test.ts`

#### Manual Verification:

- (none — no user-reachable surface exists until Phase 2)

---

## Phase 2: The toolbar control

### Overview

Make the mode reachable: a `ToggleGroup` beside the price-view group, threaded through the editor's
existing prop chain.

### Changes Required:

#### 1. Wire the hook into the editor

**File**: `src/components/kosztorys/use-kosztorys-editor.ts`

**Intent**: Read the mode and pass it into the column build, so the grid re-renders on a mode change
the same way it already does on a price-view change.

**Contract**: Call `useMoneyAxis()` beside `usePriceView` (`:102`) / `useHiddenColumns` (`:111`); add
`moneyAxis` to the `columnOpts` object (`:138-153`); return `moneyAxis` + its setter from the hook.
No remount `key` anywhere — the grid is reactive.

#### 2. Thread through the body

**File**: `src/components/kosztorys/kosztorys-editor-body.tsx`

**Intent**: Pass the mode and setter from the editor hook to the toolbar, alongside the existing
`columnToggleItems` / `toggleColumn` pair.

**Contract**: Two new props forwarded to `KosztorysEditorToolbar`.

#### 3. The control

**File**: `src/components/kosztorys/kosztorys-editor-toolbar.tsx`

**Intent**: Render the mode as a three-segment toggle next to the price-view toggle — the second
reading axis rendered like the first.

**Contract**: `PropsT` gains `moneyAxis: MoneyAxisT` + `onMoneyAxisChange: (axis: MoneyAxisT) => void`.
A module-level `MONEY_AXES: { value: MoneyAxisT; label: string }[]` (`Netto` / `Brutto` / `Oba`) drives
a `ToggleGroup`, placed immediately after the `VIEWS` group (`:96-103`) and wrapped in its own
`SimpleTooltip` legend, Polish, matching `VIEW_LEGEND`'s register. The legend must state the one
non-obvious rule: `Cena j.m. netto` is always visible, and the mode only narrows what the column
picker already allows.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`

#### Manual Verification:

- `Netto` drops all six brutto columns from the grid; `Cena j.m. netto` stays.
- `Brutto` drops `Wartość przedmiaru netto`, `Netto`, `Pozostało netto`, `Rabat kwota netto`, and the
  per-stage netto block — and `Cena j.m. netto` still stays.
- `Oba` restores exactly what the picker allows (stage brutto stays hidden — `DEFAULT_HIDDEN_COLUMNS`).
- The mode survives a page reload and holds across all three price views.
- The column picker's menu is unchanged in every mode — a picker-checked column that the mode hid
  still reads as checked.
- `Suma netto` and `Suma brutto` both stay in the Sekcje panel in every mode.
- No flicker or scroll jump when switching modes on a large kosztorys (`INV=7`, ~1000 rows).
- The non-guarantee reads acceptably: hide `Brutto` in the picker, set mode `Brutto` → the column
  stays off screen. Confirm this doesn't read as a broken control.

**Implementation Note**: After Phase 2's automated verification passes, pause for manual confirmation.

---

## Testing Strategy

### Unit Tests:

New spec `src/__tests__/kosztorys-money-axis.test.ts`, driving `buildV2Columns` (a pure function —
no DOM, no grid) and asserting the **rendered column ids**, not the predicate's internals:

- `both` → the same column set as today (the regression guard for "the mode is opt-out").
- `net` → no `gross`-tagged id survives; `price` survives.
- `gross` → no `net`-tagged id survives **except** `price`.
- Neutral columns (`plannedQty`, `unit`, `discountType`, the `stage_<id>` qty block) survive every
  mode — the fail-open property.
- Composition: a column the picker hides stays hidden in every mode, including the one whose axis
  would allow it (`isHidden: (id) => id === 'gross'`, axis `gross` → no `gross` column).
- Stage columns collapse by group: with two stages, mode `net` keeps both `stageValueNet_*` and drops
  both `stageValueGross_*` — proving the map keys by `toggleKey` and no stage id leaked into it.
- Map integrity: every key in `COLUMN_MONEY_AXIS` exists in `COLUMN_LABELS`, and every exempt key is
  tagged. Cheap, and it catches the rename that silently un-tags a column.

### Integration Tests:

None. There is no server boundary, no DB, and no action in this change.

### Manual Testing Steps:

The Phase 2 Manual Verification list is the script; run it against `INV=6` (realistic rozpiska) and
re-check the flicker/scroll item against `INV=7` (~1000 rows). Seeding commands are in `AGENTS.md`.

## Performance Considerations

None to weigh. dsg virtualizes rows but **not** columns — ~35 cells render regardless of dataset size
— and the axis test is a `Set`/`Record` lookup per column per build, on a list of ~21 + 3×`stages`.
It runs where `isHidden` already runs. Fewer columns is strictly less render work than today.

## Migration Notes

None. No schema, no stored data. An absent `table-columns:kosztorys-axis` key means `both`, which is
today's behaviour — every existing user lands on the current grid until they touch the control.

## References

- Frame (parent change; **read the SUPERSEDED note at `:124-129`**, not the paragraph above it):
  `context/changes/kosztorys-stage-values/frame.md`
- Research (parent change): `context/changes/kosztorys-stage-values/research.md`
- Settled shaping: `context/changes/kosztorys-netto-brutto-select/change.md`
- The filter to extend: `src/lib/tables/kosztorys-v2-columns.tsx:686-699`
- Storage-hook precedent: `src/components/kosztorys/use-price-view.ts` · `use-hidden-columns.ts`
- Control precedent: `src/components/kosztorys/kosztorys-editor-toolbar.tsx:16-38,96-103`
- Remount-key trap: `context/foundation/lessons.md:119-135` (commit `ee497cb`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The axis as a model (no UI)

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — c385ad1
- [x] 1.2 Linting passes: `pnpm lint` — c385ad1
- [x] 1.3 New axis specs pass: `pnpm exec vitest run src/__tests__/kosztorys-money-axis.test.ts` — c385ad1
- [x] 1.4 The existing kosztorys suites still pass — c385ad1

### Phase 2: The toolbar control

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — e76d45c
- [x] 2.2 Linting passes: `pnpm lint` — e76d45c
- [x] 2.3 Full unit suite passes: `pnpm test` — e76d45c
