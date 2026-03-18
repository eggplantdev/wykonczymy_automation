# Investment Payouts Tracking

## Problem

The investment view tracks investor-facing costs (LABOR_COST) but has no way to track real internal costs (PAYOUT). The user needs to see "what did this investment actually cost me?" separately from "what does the investor owe me?"

## Solution

Allow PAYOUT transfers to optionally link to an investment. Display payouts as a new stat card ("Wypłaty") that swaps with the existing "Koszty robocizny" card via a paired toggle — only one is active at a time.

- **Default view (investor):** Bilans = income - material costs - labor costs
- **Internal view:** Bilans = income - material costs - payouts

## Design

### Data Layer

1. **`src/lib/constants/transfers.ts`**
   - Add `PAYOUT` to `INVESTMENT_TYPES` array
   - Do NOT add to `COST_TYPES` or `requiresInvestment` — investment is optional for payouts

2. **`src/collections/transfers.ts`**
   - Add `data?.type === 'PAYOUT'` to `showInvestment` condition in Payload admin

3. **`src/lib/db/sum-transfers.ts`**
   - Add `COALESCE(SUM(CASE WHEN type = 'PAYOUT' THEN amount ELSE 0 END), 0) AS total_payouts` to `sumAllInvestmentFinancials()` SQL
   - Only payouts with `investment_id IS NOT NULL` are included (existing WHERE clause handles this)

4. **Types (`InvestmentFinancialsT`)**
   - Add `totalPayouts: number` field

5. **`deriveFinancials()`**
   - Add `totalPayouts: totalByType(byType, 'PAYOUT')` — required for the reports page which uses this path instead of `sumAllInvestmentFinancials()`

### Stat Card & Paired Toggle

1. **`src/lib/map-category-costs.ts`** (`buildFinancialFields()`)
   - Add new entry: `{ label: 'Wypłaty', value: formatPLN(totalPayouts), amount: -totalPayouts, pairedWith: 'Koszty robocizny' }`
   - Add `pairedWith: 'Wypłaty'` to the existing "Koszty robocizny" entry

2. **`HeaderFieldT` type** (`src/types/export.ts`)
   - Add optional `pairedWith?: string` field

3. **`StatEntryT` type** (`src/components/ui/toggle-stat-buttons.tsx`)
   - Add optional `pairedWith?: string` field

4. **`src/components/investments/financial-stats.tsx`**
   - Propagate `pairedWith` from `HeaderFieldT` through to `StatEntryT` in the mapping (currently only passes `label`, `value`, `amount`, `borderColor`)
   - Add "Wypłaty" to `FIXED_FIELD_COLORS` so it gets a dedicated color instead of consuming a category palette slot

5. **`src/components/ui/toggle-stat-buttons.tsx`**
   - Add `defaultHidden?: boolean` to `StatEntryT` — entries with `defaultHidden: true` start in the `hidden` Set
   - Initialize `hidden` state from entries: `new Set(entries.filter(e => e.defaultHidden).map(e => e.label))`
   - Modify `toggle()`: when a card with `pairedWith` is clicked:
     - If it's hidden: show it, hide its pair
     - If it's already visible: no-op (one must always be active)
   - Fire `onToggle` for **both** the clicked card and its pair to keep the Zustand store in sync
   - When `pairedWith` is undefined, existing toggle behavior is preserved unchanged

6. **`src/stores/header-fields-store.ts`**
   - Initialize default visibility for paired cards: "Wypłaty" starts as `false` in the visibility record
   - Alternative: accept `defaultHidden` labels in a `reset()` call from `FinancialStats`

7. **Default visibility**
   - "Koszty robocizny" — visible by default
   - "Wypłaty" — hidden by default (`defaultHidden: true`)

### Print/Export

No changes needed. `print-button.tsx` already reads visibility from the Zustand store and filters fields accordingly. The paired toggle fires `onToggle` for both cards in a swap, so the store stays in sync.

### Reports View

- Stat cards: uses `buildFinancialFields()` — works automatically
- Pie chart (`src/components/reports/report-charts.tsx`): reads directly from `InvestmentFinancialsT`, NOT from `buildFinancialFields()`. Add a "Wypłaty" slice to the chart data. Since the chart doesn't have toggle state, show both labor costs and payouts as separate slices.

### Tests

1. **`toggle-stat-buttons.test.ts`**
   - Paired toggle: clicking hidden paired card shows it and hides its pair
   - Cannot toggle both off — clicking visible paired card is no-op
   - `defaultHidden` entries start in hidden set
   - Non-paired entries: existing toggle behavior unchanged

2. **`dashboard-aggregation.test.ts`**
   - Verify `totalPayouts` aggregation from SQL

3. **Existing tests to update**
   - `transfer-constants.test.ts` — update `showsInvestment` truth table to include `PAYOUT`
   - `sum-transfers.test.ts` — update `InvestmentFinancialsT` assertions to include `totalPayouts`
   - `computeSummary` and `calculateBilans` tests remain valid (functions unchanged)

## Edge Cases

- **Existing PAYOUT transfers without `investment_id`**: ignored by investment queries (WHERE clause filters them out). No migration needed.
- **Reports page `totalPayouts`**: `deriveFinancials()` path filters by specific investment, so only investment-linked payouts are included.
- **Dashboard**: `sumAllInvestmentFinancials()` will return `totalPayouts` per investment. Dashboard table components should not display payouts unless explicitly added — verify no unintended leakage.

## Non-Goals

- No new UI components (reuses existing toggle infrastructure)
- No changes to `computeSummary` or `calculateBilans` logic
- No separate "view mode" toggle — the swap is implicit via paired cards
- No migration for existing PAYOUT transfers
