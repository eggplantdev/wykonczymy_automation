# Investment Marża (Margin) — Redesign

## Problem

The previous payouts implementation treated Wypłaty as an alternative cost view that toggles with Koszty robocizny. This was wrong — payouts are not investment costs. They're money paid out _from_ the investment's profit.

What the business owner actually needs is **Marża** — "how much did I keep after paying people out?"

Additionally, the dashboard investments table has a bug: the Koszty column shows only material costs, but Bilans subtracts both material and labor costs. The numbers don't add up visually.

## Solution

1. **Remove** the paired toggle mechanism entirely (pairedWith, defaultHidden, buildToggleResult, row splitting)
2. **Remove Wypłaty from toggleable stat cards** — it's not a cost and must not affect Bilans
3. **Add Marża** as a derived summary display: `Marża = Bilans - totalPayouts`
4. **Show Wypłaty and Marża as summary lines** below Bilans (non-toggleable, informational)
5. **Fix dashboard table**: Koszty column = materialCosts + laborCosts (matches Bilans formula)
6. **Add Marża column** to dashboard investments table

## Design

### What stays unchanged

- `totalPayouts` in SQL (`sumAllInvestmentFinancials`), `InvestmentFinancialsT` type, `deriveFinancials` — data layer is correct
- `PAYOUT` in `INVESTMENT_TYPES` — payouts can optionally link to investments
- `PAYOUT` in Payload `showInvestment` condition
- Basic toggle show/hide behavior on stat cards (the non-paired behavior)
- `computeSummary` logic — unchanged
- `calculateBilans` in `src/lib/export/header-fields.ts` — unchanged (filters by `BILANS_LABEL`, Marża won't be in the fields array)

### What gets removed

1. **`src/types/export.ts`** — remove `pairedWith` and `defaultHidden` from `HeaderFieldT`

2. **`src/components/ui/toggle-stat-buttons.tsx`**
   - Remove `pairedWith` and `defaultHidden` from `StatEntryT`
   - Remove `buildToggleResult` function entirely
   - Revert `toggle()` to simple show/hide (no paired swap, no double `onToggle` call)
   - Revert `hidden` state init to `new Set()` (no `defaultHidden` filtering)

3. **`src/components/investments/financial-stats.tsx`**
   - Remove `LABOR_LABELS` constant and row splitting logic
   - Remove `ROW_LABELS` constant and `rowLabels` prop usage
   - Remove `defaultHidden` handling in `useEffect`

4. **`src/stores/header-fields-store.ts`**
   - Remove `defaultHidden` parameter from `reset()`
   - Revert to simple `reset: () => set({ visibility: {} })`

5. **`src/lib/map-category-costs.ts`** (`buildFinancialFields`)
   - Remove Wypłaty entry entirely (not a toggleable stat card)
   - Remove `pairedWith` and `defaultHidden` from Koszty robocizny entry

6. **Tests**
   - Remove `buildToggleResult` tests and import from `toggle-stat-buttons.test.ts`
   - Remove `defaultHidden` and paired toggle test cases from `toggle-stat-buttons.test.ts`

### What gets modified

1. **`src/components/investments/financial-stats.tsx`** — major rewrite
   - All stat cards in a single flat row: [categories..., Koszty robocizny, Wpłaty]
   - Keep `rows` as array-of-arrays (one element) — `ToggleStatButtons` signature stays unchanged since `UserRegisterStats` also uses it
   - No `rowLabels` prop (single row, no label needed)
   - Accept `totalPayouts` as a new prop (passed from parent page)
   - After `ToggleStatButtons`, render two additional `SaldoDisplay` lines:
     - **Wypłaty**: shows `totalPayouts` value (informational, always visible)
     - **Marża**: shows `Bilans - totalPayouts` (derived, updates when toggle state changes)
   - **Marża computation path**: Read Zustand visibility store in the parent, build a `hidden` Set from it, and call `computeSummary(entries, hidden)` directly. The parent already has the entries (from `buildFinancialFields` → `toEntry` mapping) and the store has visibility. No changes to `ToggleStatButtons` signature needed.

2. **`src/components/ui/toggle-stat-buttons.tsx`**
   - No signature changes. Only remove `pairedWith`, `defaultHidden`, `buildToggleResult` (listed in removals above).

3. **`src/lib/tables/investments.tsx`** (dashboard table)
   - Add `totalCosts`, `totalPayouts`, and `marza` to `InvestmentRowT`
   - Change Koszty column accessor to use `totalCosts` (materialCosts + laborCosts)
   - Add Marża column using `BalanceCell` (colored like Bilans)

4. **`src/lib/queries/dashboard.ts`**
   - Compute `totalCosts: totalMaterialCosts + totalLaborCosts`
   - Pass `totalPayouts: fin?.totalPayouts ?? 0`
   - Compute `marza: balance - totalPayouts`

5. **`src/types/export.ts`** — add `totalPayouts?: number` to `TransferTableConfigT`

6. **`src/components/transfers/print-button.tsx`**
   - Read `totalPayouts` from `config.totalPayouts`
   - After appending the Bilans line, also append Wypłaty and Marża lines to printed output
   - Wypłaty and Marża only appear when `totalPayouts` is defined (investment context only)

7. **Investment detail page** (`src/app/(frontend)/inwestycje/[id]/page.tsx`)
   - Pass `totalPayouts` to `FinancialStats` component
   - Pass `totalPayouts` in `TransferTableConfigT` for print/export

8. **Reports page** (`src/app/(frontend)/raporty/page.tsx`)
   - Pass `totalPayouts` to `FinancialStats` component
   - Pass `totalPayouts` in `TransferTableConfigT` for print/export

9. **`src/__tests__/dashboard-aggregation.test.ts`**
   - Update `InvestmentRowT` assertions to include `totalCosts`, `totalPayouts`, `marza`
   - Verify: `totalCosts = 2000 + 500 = 2500`, `marza = 5500 - 300 = 5200`

### Reports pie chart

**Pending decision.** Current state: Wypłaty shown as a slice. Leave as-is for now. Revisit after seeing the feature in use.

### Stat card layout

```
[Materiały budowlane: -15,000 zł] [Koszty robocizny: -5,000 zł] [Wpłaty: 50,000 zł]
                                                            ← toggleable, affect Bilans

Bilans: 30,000 zł (wybranych 3/3)
Wypłaty: -22,000 zł                                        ← informational, not toggleable
Marża: 8,000 zł                                            ← derived: Bilans - totalPayouts
```

### Dashboard table

| Nazwa           | Koszty    | Bilans    | Marża    |
| --------------- | --------- | --------- | -------- |
| Remont Kowalski | 20,000 zł | 30,000 zł | 8,000 zł |

Where Koszty = materialCosts (15,000) + laborCosts (5,000) = 20,000. This matches the Bilans formula: 50,000 - 20,000 = 30,000.

### Print/Export

`print-button.tsx` currently appends Bilans to the visible header fields. After this change, it should also append:

- Wypłaty line (always, showing totalPayouts)
- Marża line (Bilans - totalPayouts)

The `calculateBilans` function does NOT need changes — it still sums visible fields excluding the Bilans label. Marża and Wypłaty are not in the `headerFields` array, so they can't corrupt the calculation.

### Edge cases

- **Investment with no payouts**: Marża = Bilans (totalPayouts is 0). Both Wypłaty and Marża summary lines still show (Wypłaty: 0 zł, Marża = Bilans value).
- **Negative Marża**: Possible if payouts exceed Bilans. Display with red color via `saldoColor()` — same treatment as negative Bilans.
- **Existing PAYOUT transfers without investment_id**: Ignored by investment queries (WHERE clause filters them). No migration needed.
- **Toggle interaction**: Toggling stat cards changes Bilans, which cascades to Marża (Marża = Bilans - totalPayouts). Wypłaty line stays constant regardless of toggles.

## Non-goals

- No toggle pairing or radio-group behavior
- No row splitting in stat cards
- No changes to `computeSummary` or `calculateBilans` core logic
- No changes to transfer form or Payload collection config
- No changes to `ToggleStatButtons` component props signature (keeps `rows` as array-of-arrays, no new callbacks)
