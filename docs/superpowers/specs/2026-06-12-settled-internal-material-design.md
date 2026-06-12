# Design: „Materiały wliczone w robociznę" (settled internal material)

> **Status:** design approved in brainstorming (2026-06-12). Refines the display section of
> `docs/plan-settled-expenses.md`; that plan's data-model, math proof, migration approach and
> Sheets strategy still apply. Financial model: `docs/investment-financials-and-discount.md`.

## Problem

On R+M jobs the client pays a single labour-with-material price. The material the company buys is
**already inside the robocizna figure**, so it must:

- **leave the cash register** (real spend),
- **NOT** be billed to the investor (excluded from bilans — billing it again double-charges),
- **reduce marża** (the company absorbed that cost out of its labour markup).

No existing transfer type does this. `INVESTMENT_EXPENSE` bills the client; `LABOR_COST` doesn't
move cash; `LOSS` doesn't leave a register as an expense.

## Data model: a `settled` flag on `INVESTMENT_EXPENSE` — NOT a new type

A boolean `settled` column on the transaction. When `true`, the row is "material included in the
robocizna price". The row keeps `type = 'INVESTMENT_EXPENSE'` and its `expense_category`.

**Why a flag, not a dedicated type** (this was the central decision):

- The owner differentiates settled material **by category** (budowlane vs wykończeniowe) for
  internal accounting and stats. A type is orthogonal to category, so a type approach would need
  one type _per category_ (`INTERNAL_BUILDING_MATERIAL`, `INTERNAL_FINISHING_MATERIAL`, …),
  multiplying every time a category is added. Disqualifying.
- Keeping `type = 'INVESTMENT_EXPENSE'` preserves `expense_category` for free.
- (Note: the "a new type breaks the Google Sheet" idea is **not** a valid reason — sheet exclusion
  is driven by leaving column E empty, independent of type-vs-flag. The category argument is the
  real one.)

The cost we accept: differentiation in the app is a **display-layer special-case** on the boolean,
not a free consequence of the type. That is purely cosmetic and never touches what aggregation or
the sheet key on.

## Math (proven consistent)

Deposit D=1000, pass-through material M=200, settled material S=100, robocizna L=500, payouts P=0.
Company holds `1000−200−100 = 700` in the register.

- **Bilans** = `D − (materiały − S) − L` = `1000 − 200 − 500` = **+300** (client credit)
- **Marża** = `L − P − S` = `500 − 0 − 100` = **+400**
- Check: `300 + 400 = 700` = cash in the register. ✅ Nothing lost, nothing double-counted.

Live marża formula becomes: `robocizna − wypłaty − rabat − strata − settled`.
Bilans is unchanged in code — settled is simply excluded from material costs, so
`wpłaty − materiały − robocizna` already ignores it.

## Where it appears (three surfaces)

### 1. Transfers table (investment detail + raporty)

`src/lib/tables/transfers.tsx`. When `row.original.settled`:

- **Type cell** renders **„Materiały wliczone w robociznę"** instead of the generic
  „Wydatek inwestycyjny".
- **Amount** uses `chart-orange` (ties it to robocizna).
- The **category column is unchanged** — still shows budowlane/wykończeniowe, so both dimensions are
  visible on the row at once.

Requires threading `settled` onto the row data (check `transfer-table-server.tsx`).

### 2. Financial-stats summary — standalone, split by category

`src/components/investments/financial-stats.tsx`. A new block mirroring the Strata pattern
(`:85-89`), rendered when there is any settled spend, **outside the bilans `ToggleStatButtons`** —
sitting outside the toggle is what visually proves "not added to the investor total":

- **One orange `StatButton` per expense category** that has non-zero settled spend, labelled with
  the category name (budowlane / wykończeniowe / …). This is the "split it" requirement.
- Settled is **excluded** from `buildFinancialFields` (so it never enters the bilans toggle sum) and
  fed only into the marża calc: `calculateMargin(totalLaborCosts, totalPayouts, totalRabat,
totalLoss, totalSettled)`.
- Admin-visible (same gate as Wypłaty/Marża).

### 3. Investments list

`sumAllInvestmentFinancials` gets a `total_settled` bucket and the same label, so the per-investment
list view shows the figure too.

## Aggregation (`src/lib/db/sum-transfers.ts`)

- `InvestmentFinancialsT` += `totalSettled: number` and a per-category settled breakdown
  (e.g. `settledCategoryCosts: CategoryCostT[]`) for the split buttons.
- `sumFilteredByType` — bucket settled as pseudo-type `INVESTMENT_EXPENSE_SETTLED`
  (`CASE WHEN type='INVESTMENT_EXPENSE' AND settled IS TRUE THEN 'INVESTMENT_EXPENSE_SETTLED' …`).
- `sumCategoryBreakdown` — add `AND settled IS NOT TRUE` so settled drops out of the **bilans**
  category buttons; add a parallel query that returns the **settled** spend grouped by category for
  the new block.
- `deriveFinancials` — `totalMaterialCosts` already excludes settled (bucket removed it);
  `totalSettled = totalByType(byType, 'INVESTMENT_EXPENSE_SETTLED')`.
- `sumAllInvestmentFinancials` — `total_costs` CASE gets `AND settled IS NOT TRUE`; add
  `total_settled`; category subquery gets `AND settled IS NOT TRUE`.

## Migration

Hand-write (migrate:create phantom drift). Mirror `src/migrations/20260611_1_add_loss_enum.ts`:

```sql
-- up
ALTER TABLE "transactions" ADD COLUMN "settled" boolean DEFAULT false;
-- down
ALTER TABLE "transactions" DROP COLUMN "settled";
```

Then `pnpm generate:types` (never `git add` `payload-types.ts`).

## Collection + form

- `src/collections/transfers.ts` — `settled` checkbox, `defaultValue: false`,
  `admin.condition: (data) => data?.type === 'INVESTMENT_EXPENSE'`, Polish label
  **„Wliczone w robociznę"**, editable after the fact. Optional defensive guard in
  `src/hooks/transfers/validate.ts`: force `settled=false` when `type !== 'INVESTMENT_EXPENSE'`.
- App expense form (`src/components/forms/`): checkbox visible for `INVESTMENT_EXPENSE`; update the
  Zod schema and the server action in `src/lib/actions/` to pass `settled` through.

## Sheets (Phase 2 — deferred, unchanged from the plan)

Row stays `INVESTMENT_EXPENSE`; column E (`kwota`) left **empty** so client `SUM(E:E)` /
`SUMIF(C:C; typ; E:E)` formulas auto-exclude it; amount goes to a **new column after the RAZEM
block** with a `RAZEM wliczone` sum. New column header must **not** contain the word „kwota"
(collides with `FIELD_MATCHERS.amount = h.includes('kwota')`). Detail: `docs/plan-settled-expenses.md`
§FAZA 2.

## Out of scope

- Rabat (separate, already implemented).
- Sheets implementation (Phase 2).
- Whether `CORRECTION` can ever be settled (no — `INVESTMENT_EXPENSE` only).

## Verification (Phase 1)

- `pnpm typecheck`, `pnpm lint`.
- Unit test (`src/__tests__/`): a settled expense lowers marża by its amount and leaves bilans
  unchanged — assert the derived figures, not the action return.
- Manual: flag one expense on investment 31, compare marża/bilans against the baseline recorded in
  `docs/plan-settled-expenses.md`.
- No full suite / no push without asking (pre-push hook).
