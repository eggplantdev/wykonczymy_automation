# Investment Marża (Margin) — Redesign

## Problem

The previous payouts implementation treated Wypłaty as an alternative cost view that toggles with Koszty robocizny. This was wrong — payouts are not investment costs. They're money paid out _from_ the investment's profit.

What the business owner actually needs is **Marża** — "how much did I keep after paying people out?"

Additionally, the dashboard investments table has a bug: the Koszty column shows only material costs, but Bilans subtracts both material and labor costs. The numbers don't add up visually.

## Solution

1. **Remove** the paired toggle mechanism entirely (pairedWith, defaultHidden, buildToggleResult, row splitting)
2. **Add Marża** as a new calculated field: `Marża = Bilans - totalPayouts`
3. **Keep Wypłaty** as a regular stat card (not paired, not a cost — just informational)
4. **Fix dashboard table**: Koszty column = materialCosts + laborCosts (matches Bilans formula)
5. **Add Marża column** to dashboard investments table

## Design

### What stays unchanged

- `totalPayouts` in SQL (`sumAllInvestmentFinancials`), `InvestmentFinancialsT` type, `deriveFinancials` — data layer is correct
- `PAYOUT` in `INVESTMENT_TYPES` — payouts can optionally link to investments
- `PAYOUT` in Payload `showInvestment` condition
- Basic toggle show/hide on stat cards (the non-paired behavior)
- `computeSummary` logic — unchanged

### What gets removed

1. **`src/types/export.ts`** — remove `pairedWith` and `defaultHidden` from `HeaderFieldT`

2. **`src/components/ui/toggle-stat-buttons.tsx`**
   - Remove `pairedWith` and `defaultHidden` from `StatEntryT`
   - Remove `buildToggleResult` function entirely
   - Revert `toggle()` to simple show/hide (no paired swap, no double `onToggle` call)
   - Revert `hidden` state init to `new Set()` (no `defaultHidden` filtering)

3. **`src/components/investments/financial-stats.tsx`**
   - Remove `LABOR_LABELS` constant and row splitting logic
   - Remove "Robocizna (wybierz jedną z dwóch opcji)" row label
   - Render all stat cards in a single flat list (one row)

4. **`src/stores/header-fields-store.ts`**
   - Remove `defaultHidden` parameter from `reset()`
   - Revert to simple `reset: () => set({ visibility: {} })`

5. **Tests**
   - Remove `buildToggleResult` tests from `toggle-stat-buttons.test.ts`
   - Remove `defaultHidden` and paired toggle test cases

### What gets added

1. **`src/lib/map-category-costs.ts`** (`buildFinancialFields`)
   - Remove `pairedWith` and `defaultHidden` from Wypłaty and Koszty robocizny entries
   - Add Marża entry: `{ label: 'Marża', value: formatPLN(bilans - totalPayouts), amount: bilans - totalPayouts }`
   - Where `bilans = totalIncome - totalMaterialCosts - totalLaborCosts`
   - Field order: [categories..., Koszty robocizny, Wypłaty, Wpłaty, Bilans, Marża]

2. **`src/lib/tables/investments.tsx`** (dashboard table)
   - Add `totalPayouts` to `InvestmentRowT`
   - Fix Koszty column: display `totalMaterialCosts + totalLaborCosts` instead of just `totalMaterialCosts`
   - Add Marża column: `balance - totalPayouts` (where balance is already `income - materialCosts - laborCosts`)

3. **`src/lib/queries/dashboard.ts`**
   - Pass `totalPayouts` through to `InvestmentRowT`

4. **`src/components/investments/financial-stats.tsx`**
   - Add 'Marża' to `FIXED_FIELD_COLORS` so it gets a dedicated color

### Reports pie chart

**Pending decision.** Current state: Wypłaty shown as a slice. Options:

- A) Keep Wypłaty slice, no Marża slice (Marża is derived, not a raw category)
- B) Add Marża slice alongside Wypłaty
- C) Replace Wypłaty with Marża

Leave as-is for now (option A). Revisit after seeing the feature in use.

### Stat card layout

All stat cards render in a single flat row (no grouping). The toggle behavior is simple show/hide — clicking a card toggles its visibility in the Bilans/Marża summary calculation. No pairing.

### Example

| Field               | Value         |
| ------------------- | ------------- |
| Materiały budowlane | -15,000 zł    |
| Koszty robocizny    | -5,000 zł     |
| Wypłaty             | -22,000 zł    |
| Wpłaty              | 50,000 zł     |
| **Bilans**          | **30,000 zł** |
| **Marża**           | **8,000 zł**  |

Dashboard table:

| Nazwa           | Koszty    | Bilans    | Marża    |
| --------------- | --------- | --------- | -------- |
| Remont Kowalski | 20,000 zł | 30,000 zł | 8,000 zł |

### Edge cases

- **Investment with no payouts**: Marża = Bilans (totalPayouts is 0)
- **Negative Marża**: Possible if payouts exceed Bilans. Display as negative with red color (same as negative Bilans in `BalanceCell`)
- **Existing PAYOUT transfers without investment_id**: Ignored by investment queries (WHERE clause filters them). No migration needed.

## Non-goals

- No toggle pairing or radio-group behavior
- No row splitting in stat cards
- No changes to `computeSummary` or `calculateBilans` core logic
- No changes to transfer form or Payload collection config
