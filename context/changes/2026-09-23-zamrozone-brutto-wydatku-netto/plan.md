# Frozen brutto for the netto expense — Implementation Plan

## Overview

A wydatek netto (`INVESTMENT_EXPENSE_NET`) shows in the kosztorys v2 „Wydatki inwestycyjne" table
as a „<kategoria> netto" row. Its netto is already the recorded Σ `net_amount`. Its brutto is still
derived: `toGross(netto, materiały rate)`. So changing the stawka moves a brutto that is not on the
invoice. The one prod row (inv. 146) shows 5477,60 against the invoice's 4809,60.

This change makes the row's brutto the recorded Σ `amount`, so no stawka moves its netto, brutto or
Różnica. It also removes the pie beside the table.

## Current State Analysis

- Every SQL aggregation already returns `SUM(amount)` (`total`) and `SUM(net_amount)` (`netTotal`)
  (`src/lib/db/sum-transfers.ts:143-165, 255-312`).
- `billedTotalOf` → `billedAmountFor` keeps only the netto for this type. That feeds
  `deriveCategoryBreakdowns` (`src/lib/db/investment-financials.ts:37-61`), whose
  `netCategoryCosts` is netto-only.
- `buildMaterialsBreakdown` (`src/lib/queries/investment-financial-fields.ts:54-62`) builds the
  netto rows from `netCategoryCosts`. `MaterialsBreakdownRowT` (`src/types/investment-financials.ts:59-64`)
  has no brutto field.
- `breakdownRowPair` (`src/lib/kosztorys/summary-economics.ts:31-37`) derives that row's brutto from
  the rate. It has two readers: the table (`materials-breakdown-table.tsx`) and `expensePieSlices`
  (`chart-slices.ts:84-95`).
- `materialsPair` (`summary-economics.ts:66-70`) has an aggregate `.gross` that nothing outside tests
  reads. Its only caller is `billedMaterials`, which takes `.net`.
- **No billed figure reads the netto bucket's brutto**: bilans, Łącznie, Pozostało, marża, the
  listing and the parity specs all use `.net`. The change is display-only.

## Desired End State

On the „Materiały" tab, wherever it renders (the v2 editor, the investment page panel, the client
share / investor preview), when a materiały rate is in effect:

- a „… netto" row shows its invoice netto, its invoice brutto, and Różnica = netto − brutto;
- all three are identical at any stawka;
- only the brutto rows move with the stawka.

With no rate in effect (none saved, or rozliczenie brutto), the table keeps its single „Kwota"
column and the „… netto" row shows its netto. That is today's behaviour, reaffirmed by the owner.

The per-category pie beside the table is gone.

### Key Discoveries:

- The brutto is already in the query rows. Only `billedAmountFor` discards it, so no SQL changes.
- A netto row always has a category (`needsExpenseCategory`, `constants/transfers.ts:550`), so a
  per-category sum covers the whole bucket.
- The type is `settleable: false`, and both derivers ignore `settled` for it
  (`investment-financials.ts:51, 87`). The brutto sum must count settled netto rows too.
- Every test fixture sits exactly 23% apart (`seed-materials-net.ts:52-66`, `seed-client-share.ts:123`).
  At a 0.23 rate, frozen and derived coincide, so every new assertion uses 8%-apart amounts and a
  rate other than 0.08.

## What We're NOT Doing

- Any SQL, migration, or change to how the netto is billed (bilans, marża, Łącznie, listing).
- Showing Netto/Brutto columns when no rate is in effect (owner Q1: keep „Kwota").
- Touching the overview's „Struktura kosztów" pie or `showPie` on `SummaryOverviewTab`.
- Changing fixture amounts in `seed-materials-net.ts` / `seed-client-share.ts`: parity and E2E
  specs depend on them. Only the false comment is fixed.
- An E2E spec (owner chose unit + DOM).

## Implementation Approach

Carry a second per-category sum from `deriveCategoryBreakdowns` straight to
`buildMaterialsBreakdown`, next to `netCategoryCosts`. It does not go through
`InvestmentFinancialsT`: nothing on that object needs it, so `['investment-financials-v2']` keeps
its shape and its key.

Make the netto row carry its recorded brutto as a required field of a discriminated union, so
`breakdownRowPair` cannot fall back to deriving it. Then delete the code that only existed to
derive or to display it.

## Critical Implementation Details

- **Cache keys.** Two `unstable_cache` payloads widen, and an old entry would lack the new field,
  producing `NaN` brutto on a warm server (lesson: „Widening a type that flows through an
  `unstable_cache` payload needs a KEY bump"):
  - `CategoryBreakdownsT` in `['category-breakdowns', …]` (`src/lib/queries/transfer-totals.ts:27`);
  - `materialsBreakdown` in `['preview-kosztorys-editor-data']` (`src/lib/queries/preview-kosztorys.ts:96`).

  Bump both in the same commit as the shape change.

- **Tests that go tautological.** `chart-slices.test.ts` computes its expected Razem with
  `breakdownRowPair` itself. It is deleted with the pie (Phase 3), not rewritten.
  `summary-economics.test.ts` round-trip and `materialsPair` blocks encode the old definition: rewrite
  them red first, don't add alongside (lesson: „A test that guards the OLD definition goes
  tautological").

## Phase 1: Carry the recorded brutto

### Overview

The netto rows reach the table knowing their invoice brutto. No rendered figure changes yet.

### Changes Required:

#### 1. Per-category brutto sum

**File**: `src/lib/db/investment-financials.ts`, `src/types/investment-financials.ts`

**Intent**: `deriveCategoryBreakdowns` also sums the recorded `total` (Σ `amount`) of the
netto-billed types per category, next to the existing netto map, with the same `settled`-agnostic
rule.

**Contract**: `CategoryBreakdownsT` gains `netCategoryGrossCosts: CategoryCostT[]`, the same
categories as `netCategoryCosts`, valued at brutto. Select rows by `billsNetAmount(type)`, as the
netto map does, never by type name.

#### 2. Netto row carries its brutto

**File**: `src/types/investment-financials.ts`, `src/lib/queries/investment-financial-fields.ts`,
`src/lib/queries/whole-investment-financials.ts`

**Intent**: A `netBilled` row carries its recorded brutto as a required field.
`buildMaterialsBreakdown` fills it from the new sum. `deriveWholeInvestmentFinancials` passes
`breakdowns.netCategoryGrossCosts` through.

**Contract**:

- `MaterialsBreakdownRowT` becomes a union:
  - `{ id, label, net, origin: 'gross' }`
  - `{ id, label, net, origin: 'netBilled', recordedGross: number }`
- `buildSettledBreakdown` is unchanged: its rows stay `gross`.
- Update the doc comment on the type. It currently says a netto row is re-priced by the rate.

#### 3. Cache keys

**File**: `src/lib/queries/transfer-totals.ts:27`, `src/lib/queries/preview-kosztorys.ts:96`

**Intent**: Make pre-change entries unreachable.

**Contract**: `'category-breakdowns'` → `'category-breakdowns-v2'`;
`'preview-kosztorys-editor-data'` → `'preview-kosztorys-editor-data-v2'`.

### Success Criteria:

#### Automated Verification:

- New spec in `src/__tests__/lib/db/investment-financials.test.ts`:
  - `deriveCategoryBreakdowns` returns `netCategoryGrossCosts` = Σ `total` of netto rows per
    category (8%-apart literals, e.g. 4809,60 / 4453,33);
  - a `settled: true` netto row still counts;
  - a brutto-type row never enters it.
- `src/__tests__/lib/queries/investment-financial-fields.test.ts` passes with the netto rows carrying
  `recordedGross`.
- `pnpm exec vitest run src/__tests__/lib/db/investment-financials.test.ts src/__tests__/lib/queries/investment-financial-fields.test.ts`

#### Manual Verification:

- None for this phase (no rendered change).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Price the netto row from the invoice

### Overview

The table's „… netto" row, and the Razem built from it, take their brutto from the invoice.

### Changes Required:

#### 1. `breakdownRowPair`

**File**: `src/lib/kosztorys/summary-economics.ts`

**Intent**: A `netBilled` row with a rate returns `{ net: row.net, gross: row.recordedGross }`. With
`rate == null` it still returns `faceValue(row.net)`, because the single „Kwota" column shows what
the investor is billed (owner Q1). Brutto rows are unchanged.

**Contract**: The signature takes `MaterialsBreakdownRowT`. Rewrite the comments above
`breakdownRowPair`: „one rate spans the bridge in both directions" is no longer true for a netto row.

#### 2. Delete the unread aggregate

**File**: `src/lib/kosztorys/summary-economics.ts`

**Intent**: `materialsPair` exists only to feed `billedMaterials(...).net`. Its `.gross` would now
be a derived figure that disagrees with the rows, and nothing reads it. Delete it. `billedMaterials`
computes the billed netto directly: the brutto base through `billedMaterialsPair(...).net`, plus
`netBilled` at face value.

**Contract**: `billedMaterials(materials: MaterialsT, netRate)` keeps its signature and value;
`MaterialsT` is unchanged. No caller outside `summary-economics.ts` changes.

#### 3. Tests, red first

**File**: `src/__tests__/lib/kosztorys/summary-economics.test.ts`

**Intent**: Replace the assertions that encode the derived brutto: `:68-72`, `:74-77`, `:94-96`,
`:103-131`, `:343`. The new ones:

- a netto row keeps `{ net: 4453.33, gross: 4809.60 }` at rates 0.12 and 0.23;
- the no-rate row is `faceValue(net)`;
- a negative netto row keeps its own recorded brutto;
- `billedMaterials` equals its previous values.

Write them failing against the current code before step 1 lands.

#### 4. DOM spec for the table

**File**: `src/__tests__/components/kosztorys/summary/tables/materials-breakdown-table.test.tsx`
(new)

**Intent**: Pin the rendered behaviour, using one brutto row and one netto row (4809,60 / 4453,33):

- **Rate 0.23 vs 0.12:** the netto row renders 4453,33 / 4809,60 / −356,27 at both; the brutto
  row's Netto and Różnica differ between the two; Razem Brutto = brutto row + 4809,60.
- **`netRate={null}`:** one „Kwota" column, and the netto row shows 4453,33.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/summary-economics.test.ts`
- `pnpm exec vitest run src/__tests__/components/kosztorys/summary/tables/materials-breakdown-table.test.tsx`

#### Manual Verification:

- Kosztorys v2 of investment 146 (local dump), „Materiały" tab, stawka 23% →
  „Materiały wykończeniowe netto" reads 4453,33 / 4809,60 / −356,27.
- Change the stawka to 12% → that row is unchanged; „Materiały budowlane" Netto and Różnica move.
- Switch rozliczenie to brutto → a single „Kwota" column; the netto row shows 4453,33; Razem equals
  „Materiały" in Podsumowanie.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Remove the „Wydatki inwestycyjne" pie

### Overview

The pie beside the table goes (owner Q3), along with the code that only served it.

### Changes Required:

#### 1. Expenses tab

**File**: `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx`,
`src/components/kosztorys/summary/summary-panel-content.tsx`

**Intent**: Stop rendering `SlicePie` on the expenses tab. Drop that tab's now-dead `showPie` prop,
and its pass-through at `summary-panel-content.tsx:317`. Fix the comment above the settled table
that mentions „the pie's shares".

**Contract**:

- `SummaryExpensesTab` loses `showPie`.
- `SummaryOverviewTab.showPie` and `SummaryPanelContent.showPies` stay: the overview pie still reads
  them.
- The layout wrapper that held table + pie side by side can collapse if it now holds one column.

#### 2. Pie helper

**File**: `src/lib/kosztorys/chart-slices.ts`, `src/__tests__/lib/kosztorys/chart-slices.test.ts`

**Intent**: Delete `expensePieSlices` and its spec. The spec tests only this function, so the file
goes. Keep `paintSlices` and the other slice builders the overview uses.

### Success Criteria:

#### Automated Verification:

- `grep -rn "expensePieSlices" src e2e` returns nothing.
- `pnpm exec vitest run src/__tests__/components/kosztorys/summary/summary-panel-content.test.tsx`

#### Manual Verification:

- The „Materiały" tab shows no pie in the editor or in the client share preview; the Podsumowanie
  „Struktura kosztów" pie is still there.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Docs

### Overview

Correct the two written claims this change falsifies.

### Changes Required:

#### 1. Domain notes

**File**: `context/reference/kosztorys-editor-domain-notes.md:527-536`

**Intent**: Replace the „WYJĄTEK — wydatek typu netto" paragraph. It still states
`brutto = netto × (1 + (materialsNetRate ?? vatRate))`. The replacement says:

- both amounts come from the invoice and no stawka moves them;
- with no stawka in effect, the single „Kwota" column shows the netto;
- the rounding-drift „Pułapka" is closed rather than reopened.

Record that this reverses the 2026-08-07 bridge ruling (owner, 2026-09-23).

#### 2. Fixture comment

**File**: `src/scripts/seed-materials-net.ts:52`

**Intent**: The comment says the amounts are „deliberately not VAT apart". They are exactly 23%
apart. Correct it to say so, and note that at a 0.23 materiały rate this fixture cannot tell a
frozen brutto from a derived one.

### Success Criteria:

#### Automated Verification:

- None (prose only).

#### Manual Verification:

- None.

---

## Testing Strategy

### Unit Tests:

- `deriveCategoryBreakdowns`: the netto brutto sum per category, settled-agnostic, excluding
  brutto types.
- `breakdownRowPair`: the frozen pair at two rates; face value at null; a negative row.
- `billedMaterials`: unchanged values after `materialsPair` is gone.

### DOM Tests:

- `MaterialsBreakdownTable`: stawka-independence of the netto row, the brutto row still moving,
  Razem, and the no-rate „Kwota" column.

### Manual Testing Steps:

1. Open inv. 146 kosztorys v2 → „Materiały" (local DB restored 2026-09-23).
2. Stawka 23% → 12% → 23%: the netto row stays fixed.
3. Rozliczenie brutto: single „Kwota" column, netto row = 4453,33.
4. The pie is gone; the overview pie is intact.

## Performance Considerations

None: one more map in an existing loop over already-fetched rows.

## Migration Notes

None. No schema change. The cache-key bumps handle warm servers on deploy.

## Whole-tree Gate

Run once, after the final phase.

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

## References

- Research + owner rulings: `context/changes/2026-09-23-zamrozone-brutto-wydatku-netto/research.md`
- Reversed decision: `context/archive/2026-07-29-netto-expense-grossup/review-gate.md:26`
- Stored-figure precedent: `context/archive/2026-07-24-netto-expense-type/change.md:34-39`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Carry the recorded brutto

#### Automated

- [x] 1.1 deriveCategoryBreakdowns spec: netCategoryGrossCosts per category, settled-agnostic, brutto types excluded
- [x] 1.2 investment-financial-fields spec passes with recordedGross on netto rows
- [x] 1.3 vitest run of both specs green

### Phase 2: Price the netto row from the invoice

#### Automated

- [ ] 2.1 summary-economics spec green (rewritten red-first)
- [ ] 2.2 materials-breakdown-table DOM spec green

### Phase 3: Remove the „Wydatki inwestycyjne" pie

#### Automated

- [ ] 3.1 no expensePieSlices references remain
- [ ] 3.2 summary-panel-content DOM spec green

### Phase 4: Docs

#### Automated

- [ ] 4.1 no automated check (prose only)
