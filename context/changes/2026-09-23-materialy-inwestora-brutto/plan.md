# Materiały w widoku inwestora — kategorie bez podziału na netto, lista tylko brutto — Implementation Plan

## Overview

On the investor pages (`/k/<token>` and „Podgląd dla inwestora") the Podsumowanie → Materiały tab
stops exposing the netto mechanics: „Wydatki inwestycyjne" shows one row per category (budowlane /
wykończeniowe / pozostałe + Razem), and the wydatki list is one list priced in brutto. The manager
view is unchanged. Pure render-layer change — no SQL, query, cache key or billed figure moves.

## Current State Analysis

- The investor pages are recognised by one prop, `preview`, threaded
  `KosztorysEditorBody → KosztorysTotalsPanel → SummaryPanelContent → SummaryExpensesTab`
  (`summary-panel-content.tsx:301-318`). It already hides the settled table and the settled list rows.
- `buildMaterialsBreakdown` (`src/lib/queries/investment-financial-fields.ts:33-67`) emits brutto rows
  per category, then „Korekta (bez kategorii)", then a trailing block of netto rows labelled
  `${cat.name} netto` — each carrying the **same category `id`** as its brutto twin.
- `MaterialsBreakdownTable` (`materials-breakdown-table.tsx`) prices each row with `breakdownRowPair`
  (`summary-economics.ts:32-38`) and sums pairs into Razem. Rendered twice in
  `summary-expenses-tab.tsx:114-128` (investor wydatki; settled, manager-only).
- `MaterialsTransactionsTable` (`materials-transactions-table.tsx`) partitions rows into
  `gross` / `net` / `settled` tabs (`expense-datasets.ts:16-26`); the netto tab shows Netto + Brutto,
  footer is `sumBilled` (Σ `billed`). In preview it filters with `clientVisibleExpenseRows`.

## Desired End State

On an investor page:

- „Wydatki inwestycyjne" has one row per category, no „… netto" row. Columns unchanged: Netto /
  Brutto / Różnica with a stawka, single „Kwota" without. Razem identical to today's in every column
  (so it still equals „Materiały" in Podsumowanie).
- „Lista wydatków" is one list — no brutto / netto tab switch — with a single „Kwota" column = the
  recorded brutto (`amount`), Razem = Σ brutto. A settled netto invoice stays in it. „Pobierz faktury"
  packs the whole list under the generic label „Materiały".

In the manager editor and the investment page: pixel-identical to today.

Verify: the node + DOM specs below, the rewritten `e2e/client-share.spec.ts`, and the manual checks.

### Key Discoveries:

- Audience gate is `preview`, never the grid's `priceView` — `context/foundation/lessons.md:471-482`
  (a column-view flag reused as an audience flag already caused a bug here).
- Merge must happen **after** pricing: a merged category is half rate-driven (brutto receipts) and
  half frozen (invoice netto/brutto), so it can't be a single `MaterialsBreakdownRowT`.
- Summing priced pairs per category leaves Razem mathematically unchanged — the invariants in
  `materials-breakdown-table.test.tsx` and `summary-economics.test.ts:78-79` keep holding.
- The investor list total ≥ billed materiały (research.md → „Q1 verified"); accepted by the owner.
- `DataTable` virtualizes; no existing DOM spec renders a virtualized body, and jsdom has no layout —
  body rows may not render there. Footer and header are outside the virtualized body.
- `seed-client-share.ts:122-156` books the brutto (2460) and netto (1230 / 1000) expense in the
  **same** category — the E2E can assert both the merged row and Razem 3690.

## What We're NOT Doing

- No change to the manager view, including the editor's „Inwestor" column view.
- No SQL / query / cache-key change; the investor payload still carries the split rows (never raised
  as a disclosure concern — owner ruling).
- No change to the no-stawka „Kwota" semantics (netto invoice at its netto) — Q3 = A.
- No change to `clientVisibleExpenseRows` — a settled netto invoice stays visible (Q5).
- Not running `pnpm test:e2e` — the owner runs it.

## Implementation Approach

A pure helper turns raw breakdown rows into **priced display rows** (`label` + `MoneyPairT`), in two
flavours: per-row (manager, today's rendering) and per-category (investor). The table renders priced
rows and sums their pairs; a boolean prop picks the flavour, set from `preview` in the tab. The list
branches on its existing `preview` prop into a single-dataset render.

## Phase 1: „Wydatki inwestycyjne" merged per category for the investor

### Overview

One row per category on investor pages; manager rendering identical.

### Changes Required:

#### 1. Priced breakdown rows

**File**: `src/lib/kosztorys/breakdown-rows.ts` (new)

**Intent**: Own the step from raw rows to what the table prints, so both views share one pricing path
and the merge is testable without React.

**Contract**:

- `type PricedBreakdownRowT = { key: string; label: string; pair: MoneyPairT }`
- `pricedBreakdownRows(rows, rate)` — one entry per input row, in input order, `pair` from
  `breakdownRowPair`; a `netBilled` row's label is `${label} netto` (the suffix moves here from the
  builder). Keys stay unique: `${origin}-${id ?? 'correction'}`.
- `categoryBreakdownRows(rows, rate)` — pairs summed per category `id`; label = the category name;
  categories ordered by label (`localeCompare(…, 'pl')`, matching `fetchExpenseCategories`' name
  order), „Korekta (bez kategorii)" (`id: null`) last. A category with only netto rows still appears.
- Invariant for both: Σ `pair.net` and Σ `pair.gross` equal the Σ over `breakdownRowPair` of the
  input rows.

#### 2. Builder emits the bare category name

**File**: `src/lib/queries/investment-financial-fields.ts`

**Intent**: The category name must be single-sourced so the merge doesn't strip a suffix; the „ netto"
wording becomes a render concern in `pricedBreakdownRows`.

**Contract**: netto rows get `label: cat.name`. Update the two `'Materiały budowlane netto'`
expectations in `src/__tests__/lib/queries/investment-financial-fields.test.ts` (:139, :193). Nothing
else reads the label (verified: `MaterialsBreakdownRowT` consumers are the table, the tab, the panel
and data plumbing).

#### 3. Table renders priced rows, optionally per category

**File**: `src/components/kosztorys/summary/tables/materials-breakdown-table.tsx`

**Intent**: Replace the inline `pairOf` with the helper; add `byCategory?: boolean` (default false).
Razem = Σ of the priced rows' pairs.

**Contract**: props `{ rows, netRate, caption?, byCategory? }`. Header/column logic untouched. Update
the stale header comment („a separate frozen „… netto" row per category") to mention the investor
merge.

#### 4. Investor pages turn it on

**File**: `src/components/kosztorys/summary/tabs/summary-expenses-tab.tsx`

**Intent**: Pass `byCategory={preview}` on the „Wydatki inwestycyjne" table only (the settled table
never renders in preview).

### Success Criteria:

#### Automated Verification:

- New node spec `src/__tests__/lib/kosztorys/breakdown-rows.test.ts` passes: per-row flavour matches
  `breakdownRowPair` and suffixes netto labels; per-category flavour merges a category's brutto +
  netto rows into one, keeps a netto-only category, puts Korekta last, and preserves both Σ at rate
  0.12 / 0.23 / null (use the non-23% invoice pair from the existing specs, 4453,33 / 4809,60).
- `src/__tests__/components/kosztorys/summary/tables/materials-breakdown-table.test.tsx` passes with
  new `byCategory` cases: no „… netto" label, one row per category, Razem identical to the unmerged
  render at 0.23 and at null.
- `src/__tests__/lib/queries/investment-financial-fields.test.ts` passes with the bare label.

#### Manual Verification:

- Investor link of an investment with a wydatek netto: „Wydatki inwestycyjne" lists only
  categories + Razem; Razem equals „Materiały" in Podsumowanie (no stawka) / its Netto column does
  (stawka set).
- Same investment in the manager editor: „… netto" row still there, figures unchanged.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Investor wydatki list — one brutto list

### Overview

In preview, the list is a single dataset in brutto; manager rendering identical.

### Changes Required:

#### 1. Brutto total helper

**File**: `src/lib/kosztorys/expense-datasets.ts`

**Intent**: The investor footer sums what left the kasa, not what is billed.

**Contract**: `sumAmount(rows): number` = Σ `row.amount`, beside `sumBilled`.

#### 2. Single-dataset preview render

**File**: `src/components/kosztorys/summary/tables/materials-transactions-table.tsx`

**Intent**: When `preview`, skip the partition/toggle: render `clientVisibleExpenseRows(rows)` with
`GROSS_COLUMNS`, footer Razem = `sumAmount` spanning all but the last column, and pack the archive
under a generic label „Materiały". Manager branch untouched.

**Contract**: no prop change. Keep `getRowHref` undefined in preview as today. Add the „Materiały"
label as a constant beside `DATASET_LABELS`. Row height / container height budgeting unchanged.

### Success Criteria:

#### Automated Verification:

- New DOM spec `src/__tests__/components/kosztorys/summary/tables/materials-transactions-table.test.tsx`
  passes: with `preview` and a brutto + netto + settled fixture — no „Zestaw wydatków" radio group,
  no „Netto" header, a „Kwota" header, footer Razem = brutto + netto invoice brutto (settled excluded);
  without `preview` — the radio group is present. Asserts header/footer only (virtualized body).
- `src/__tests__/lib/kosztorys/expense-datasets.test.ts` passes with a `sumAmount` case.

#### Manual Verification:

- Investor link: „Lista wydatków" is one list, no tab switch, every row priced in brutto (the netto
  invoice at its invoice brutto), Razem = Σ brutto, above „Materiały" in Podsumowanie when a wydatek
  netto exists.
- „Pobierz faktury" on the investor link downloads a zip containing both brutto and netto invoices.
- Manager editor: three tabs as before, netto tab still Netto + Brutto.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: E2E and docs

### Overview

The client-share regression guard follows the new shape; the domain notes describe the investor view.

### Changes Required:

#### 1. Client-share spec

**File**: `e2e/client-share.spec.ts` (test at :232-284)

**Intent**: Replace the two-tab assertions with the merged shape. Keep the settled-exclusion and the
faktury-zip assertions.

**Contract**: after opening „Lista wydatków": no „Materiały brutto" / „Materiały rozliczane netto" /
„Materiały wliczone w robociznę" radio; `grossExpense` and `netExpense` descriptions both visible,
`settledExpense` absent; the list shows Razem `formatNet(2460 + 1230)`; „Wydatki inwestycyjne" shows
no label ending in „ netto"; „Pobierz faktury" still yields `faktury-*.zip`. Rename the test to what
it now guards. **Written, not run** — the owner runs `pnpm test:e2e`.

#### 2. Domain notes

**File**: `context/reference/kosztorys-editor-domain-notes.md`

**Intent**: Add the investor view of the Materiały tab: categories merged, list in brutto, list Razem
≥ billed „Materiały" by design (owner, 2026-09-23), gate = `preview`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec tsc --noEmit` accepts the edited spec (no phase-scoped runner; the E2E itself is run by
  the owner).

#### Manual Verification:

- Owner runs `pnpm test:e2e e2e/client-share.spec.ts` against a freshly seeded db-test and it passes.

**Implementation Note**: Final phase — `/10x-implement` aggregates the Manual Verification bullets
into `context/foundation/manual-checks.md`.

---

## Testing Strategy

### Unit Tests:

- `breakdown-rows.test.ts` — the merge and its Σ invariants at three rates, netto-only category,
  Korekta ordering, negative korekta sign.
- `expense-datasets.test.ts` — `sumAmount`.

### Integration Tests:

- DOM: `materials-breakdown-table.test.tsx` (`byCategory`), new `materials-transactions-table.test.tsx`
  (preview header/footer, manager toggle).
- E2E: `client-share.spec.ts` (rewritten, owner-run).

### Manual Testing Steps:

1. Investor link of inv. 146 (the one wydatek netto) — breakdown merged, list brutto, Razem as above.
2. „Podgląd dla inwestora" of the same investment — identical to the link.
3. Manager editor — unchanged, both tables and all three list tabs.

## Performance Considerations

None — the merge is O(rows) over ≤ a handful of categories.

## Migration Notes

None.

## Whole-tree Gate

Run once, after the final phase.

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`

## References

- Research: `context/changes/2026-09-23-materialy-inwestora-brutto/research.md`
- Prerequisite change: `context/changes/2026-09-23-zamrozone-brutto-wydatku-netto/` (`recordedGross`)
- Audience-flag lesson: `context/foundation/lessons.md:471-482`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: „Wydatki inwestycyjne" merged per category for the investor

#### Automated

- [x] 1.1 breakdown-rows node spec passes — 51d5323e
- [x] 1.2 materials-breakdown-table DOM spec passes with byCategory cases — 51d5323e
- [x] 1.3 investment-financial-fields spec passes with the bare label — 51d5323e

### Phase 2: Investor wydatki list — one brutto list

#### Automated

- [x] 2.1 materials-transactions-table DOM spec passes
- [x] 2.2 expense-datasets spec passes with sumAmount

### Phase 3: E2E and docs

#### Automated

- [ ] 3.1 tsc accepts the rewritten client-share spec
