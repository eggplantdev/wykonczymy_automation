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

4. **Types (`InvestmentFinancialsT`)**
   - Add `totalPayouts: number` field

5. **`deriveFinancials()`**
   - Extract `totalPayouts` from query result

### Stat Card & Paired Toggle

1. **`src/lib/map-category-costs.ts`** (`buildFinancialFields()`)
   - Add new entry: `{ label: 'Wypłaty', value: formatPLN(totalPayouts), amount: -totalPayouts, pairedWith: 'Koszty robocizny' }`
   - Add `pairedWith: 'Wypłaty'` to the existing "Koszty robocizny" entry

2. **`HeaderFieldT` type**
   - Add optional `pairedWith?: string` field

3. **`StatEntryT` type**
   - Add optional `pairedWith?: string` field

4. **`src/components/ui/toggle-stat-buttons.tsx`**
   - Modify `toggle()` function: when a card with `pairedWith` is clicked, show it and hide its pair
   - If the clicked paired card is already visible, no-op (one must always be active)
   - "Wypłaty" starts hidden by default (investor view is default)

5. **Default visibility**
   - "Koszty robocizny" — visible by default
   - "Wypłaty" — hidden by default

### Print/Export

No changes needed. `print-button.tsx` already reads visibility from the Zustand store and filters fields accordingly. The paired toggle updates the same store.

### Reports View

Uses the same `buildFinancialFields()` — works automatically.

### Tests

1. **`toggle-stat-buttons.test.ts`**
   - Paired toggle: clicking one hides the other
   - Cannot toggle both off — one must always be active
   - Default state: paired card marked as default-hidden starts hidden

2. **`dashboard-aggregation.test.ts`**
   - Verify `totalPayouts` aggregation from SQL

3. **Existing tests**
   - `computeSummary` tests remain valid (function unchanged)
   - `calculateBilans` tests remain valid (function unchanged)

## Non-Goals

- No new UI components (reuses existing toggle infrastructure)
- No changes to `computeSummary` or `calculateBilans` logic
- No separate "view mode" toggle — the swap is implicit via paired cards
