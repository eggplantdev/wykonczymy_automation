# Investment Payouts Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow PAYOUT transfers to optionally link to an investment, and display them as a toggleable stat card that swaps with "Koszty robocizny" (paired toggle).

**Architecture:** Extend the existing transfer type constants to include PAYOUT in investment-aware types. Add `totalPayouts` to the financial aggregation pipeline (SQL, types, derive). Introduce a paired toggle mechanism in `ToggleStatButtons` where two stat cards act as a radio group — only one is active at a time.

**Tech Stack:** Next.js 16, Payload CMS, Vercel Postgres (raw SQL), Zustand, TanStack Form, Vitest

**Spec:** `docs/superpowers/specs/2026-03-18-investment-payouts-tracking-design.md`

---

## File Map

| File                                             | Action | Responsibility                                  |
| ------------------------------------------------ | ------ | ----------------------------------------------- |
| `src/lib/constants/transfers.ts`                 | Modify | Add PAYOUT to INVESTMENT_TYPES                  |
| `src/collections/transfers.ts`                   | Modify | Add PAYOUT to showInvestment condition          |
| `src/lib/db/sum-transfers.ts`                    | Modify | Add totalPayouts to SQL, type, deriveFinancials |
| `src/lib/map-category-costs.ts`                  | Modify | Add Wypłaty field with pairedWith               |
| `src/types/export.ts`                            | Modify | Add pairedWith to HeaderFieldT                  |
| `src/components/ui/toggle-stat-buttons.tsx`      | Modify | Add defaultHidden, paired toggle logic          |
| `src/components/investments/financial-stats.tsx` | Modify | Propagate pairedWith, add color for Wypłaty     |
| `src/stores/header-fields-store.ts`              | Modify | Support default-hidden initialization           |
| `src/components/reports/report-charts.tsx`       | Modify | Add Wypłaty slice to pie chart                  |
| `src/__tests__/transfer-constants.test.ts`       | Modify | Update showsInvestment truth table              |
| `src/__tests__/sum-transfers.test.ts`            | Modify | Add totalPayouts to expectations                |
| `src/__tests__/toggle-stat-buttons.test.ts`      | Modify | Add paired toggle tests                         |

---

### Task 1: Constants & Payload config — allow PAYOUT to have investment

**Files:**

- Modify: `src/lib/constants/transfers.ts:65-66`
- Modify: `src/collections/transfers.ts:32-35`
- Modify: `src/__tests__/transfer-constants.test.ts:32-38`

- [ ] **Step 1: Update the test truth table**

In `src/__tests__/transfer-constants.test.ts`, add `'PAYOUT'` to the `showsInvestment.trueFor` array:

```typescript
showsInvestment: {
  fn: showsInvestment,
  trueFor: [
    'INVESTOR_DEPOSIT',
    'INVESTMENT_EXPENSE',
    'LABOR_COST',
    'COMPANY_FUNDING',
    'OTHER_DEPOSIT',
    'PAYOUT',
  ],
},
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/__tests__/transfer-constants.test.ts`
Expected: FAIL — `showsInvestment('PAYOUT')` returns `false` but expected `true`

- [ ] **Step 3: Add PAYOUT to INVESTMENT_TYPES**

In `src/lib/constants/transfers.ts`, change line 66:

```typescript
export const INVESTMENT_TYPES: TransferTypeT[] = [...COST_TYPES, ...DEPOSIT_TYPES, 'PAYOUT']
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/__tests__/transfer-constants.test.ts`
Expected: PASS

- [ ] **Step 5: Update Payload collection showInvestment**

In `src/collections/transfers.ts`, update `showInvestment` (line 32-35):

```typescript
const showInvestment = (data: Record<string, unknown>) =>
  data?.type === 'INVESTOR_DEPOSIT' ||
  data?.type === 'INVESTMENT_EXPENSE' ||
  data?.type === 'LABOR_COST' ||
  data?.type === 'PAYOUT'
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants/transfers.ts src/collections/transfers.ts src/__tests__/transfer-constants.test.ts
git commit -m "feat: allow PAYOUT transfers to link to investments"
```

---

### Task 2: Data layer — add totalPayouts to financial aggregation

**Files:**

- Modify: `src/lib/db/sum-transfers.ts:109-114,127-136,228-241`
- Modify: `src/__tests__/sum-transfers.test.ts:86-150,218-256`

- [ ] **Step 1: Update sumAllInvestmentFinancials test expectations**

In `src/__tests__/sum-transfers.test.ts`, update all `sumAllInvestmentFinancials` test rows to include `total_payouts` in mock data, and add `totalPayouts` to expected objects.

In the first test ("returns a Map of investment financials"), update mock rows:

```typescript
mockExecute
  .mockResolvedValueOnce({
    rows: [
      {
        investment_id: '1',
        total_costs: '3000',
        total_income: '10000',
        total_labor_costs: '200',
        total_payouts: '150',
      },
      {
        investment_id: '2',
        total_costs: '500',
        total_income: '0',
        total_labor_costs: '0',
        total_payouts: '0',
      },
    ],
  })
  .mockResolvedValueOnce({ rows: [] })
```

Update expected values:

```typescript
expect(map.get(1)).toEqual({
  categoryCosts: [],
  totalMaterialCosts: 3000,
  totalIncome: 10000,
  totalLaborCosts: 200,
  totalPayouts: 150,
})
expect(map.get(2)).toEqual({
  categoryCosts: [],
  totalMaterialCosts: 500,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
})
```

Similarly, update the "includes per-category costs" test mock row to include `total_payouts: '0'` and the expected result to include `totalPayouts: 0`.

- [ ] **Step 2: Update deriveFinancials test expectations**

In the `deriveFinancials` tests, add a PAYOUT entry to test data and update expected results:

For "derives totals from type distribution":

```typescript
const byType = [
  { type: 'INVESTMENT_EXPENSE', total: 5000 },
  { type: 'INVESTOR_DEPOSIT', total: 12000 },
  { type: 'LABOR_COST', total: 800 },
  { type: 'PAYOUT', total: 300 },
]
expect(deriveFinancials(byType)).toEqual({
  categoryCosts: [],
  totalMaterialCosts: 5000,
  totalIncome: 12000,
  totalLaborCosts: 800,
  totalPayouts: 300,
})
```

For "returns zeros for empty array":

```typescript
expect(deriveFinancials([])).toEqual({
  categoryCosts: [],
  totalMaterialCosts: 0,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalPayouts: 0,
})
```

For "includes category costs when provided", add `totalPayouts: 0` to expected result.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/sum-transfers.test.ts`
Expected: FAIL — `totalPayouts` missing from actual results

- [ ] **Step 4: Add totalPayouts to InvestmentFinancialsT**

In `src/lib/db/sum-transfers.ts`, update the type (line 109-114):

```typescript
export type InvestmentFinancialsT = {
  readonly categoryCosts: readonly CategoryCostT[]
  readonly totalMaterialCosts: number
  readonly totalIncome: number
  readonly totalLaborCosts: number
  readonly totalPayouts: number
}
```

- [ ] **Step 5: Add PAYOUT to sumAllInvestmentFinancials SQL**

In `src/lib/db/sum-transfers.ts`, update the SQL query (line 127-136) — add a new CASE line after `total_labor_costs`:

```sql
COALESCE(SUM(CASE WHEN type = 'LABOR_COST' THEN amount ELSE 0 END), 0) AS total_labor_costs,
COALESCE(SUM(CASE WHEN type = 'PAYOUT' THEN amount ELSE 0 END), 0) AS total_payouts
```

Update the map construction (line 160-169) to include `totalPayouts`:

```typescript
map.set(invId, {
  categoryCosts: categoryMap.get(invId) ?? [],
  totalMaterialCosts: Number(row.total_costs),
  totalIncome: Number(row.total_income),
  totalLaborCosts: Number(row.total_labor_costs),
  totalPayouts: Number(row.total_payouts),
})
```

- [ ] **Step 6: Add totalPayouts to deriveFinancials**

In `src/lib/db/sum-transfers.ts`, update `deriveFinancials` (line 228-241):

```typescript
export function deriveFinancials(
  byType: readonly TypeTotalT[],
  categoryCosts: readonly CategoryCostT[] = [],
): InvestmentFinancialsT {
  return {
    categoryCosts,
    totalMaterialCosts: totalByType(byType, 'INVESTMENT_EXPENSE'),
    totalIncome:
      totalByType(byType, 'INVESTOR_DEPOSIT') +
      totalByType(byType, 'COMPANY_FUNDING') +
      totalByType(byType, 'OTHER_DEPOSIT'),
    totalLaborCosts: totalByType(byType, 'LABOR_COST'),
    totalPayouts: totalByType(byType, 'PAYOUT'),
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/sum-transfers.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/sum-transfers.ts src/__tests__/sum-transfers.test.ts
git commit -m "feat: add totalPayouts to investment financial aggregation"
```

---

### Task 3: Types & buildFinancialFields — add Wypłaty stat card with pairedWith

**Files:**

- Modify: `src/types/export.ts:6-10`
- Modify: `src/lib/map-category-costs.ts:20-32`

- [ ] **Step 1: Add pairedWith to HeaderFieldT**

In `src/types/export.ts`, update the type:

```typescript
export type HeaderFieldT = {
  readonly label: string
  readonly value: string
  readonly amount?: number
  readonly pairedWith?: string
  readonly defaultHidden?: boolean
}
```

- [ ] **Step 2: Update buildFinancialFields to include Wypłaty**

In `src/lib/map-category-costs.ts`, update `buildFinancialFields`:

```typescript
export function buildFinancialFields(
  financials: InvestmentFinancialsT,
  expenseCategories: readonly { readonly id: number; readonly name: string }[],
): HeaderFieldT[] {
  const { categoryCosts, totalMaterialCosts, totalIncome, totalLaborCosts, totalPayouts } =
    financials

  return [
    ...mapCategoryCostsToFields(categoryCosts, expenseCategories),
    {
      label: 'Koszty robocizny',
      value: formatPLN(totalLaborCosts),
      amount: -totalLaborCosts,
      pairedWith: 'Wypłaty',
    },
    {
      label: 'Wypłaty',
      value: formatPLN(totalPayouts),
      amount: -totalPayouts,
      pairedWith: 'Koszty robocizny',
      defaultHidden: true,
    },
    { label: 'Wpłaty', value: formatPLN(totalIncome), amount: totalIncome },
    { label: BILANS_LABEL, value: formatPLN(totalIncome - totalMaterialCosts - totalLaborCosts) },
  ]
}
```

Note: The BILANS_LABEL default value uses labor costs (investor view), but the dynamic recalculation via `computeSummary` handles the toggle.

- [ ] **Step 3: Commit**

```bash
git add src/types/export.ts src/lib/map-category-costs.ts
git commit -m "feat: add Wypłaty field with paired toggle to financial fields"
```

---

### Task 4: Toggle component — paired toggle + defaultHidden

**Files:**

- Modify: `src/components/ui/toggle-stat-buttons.tsx:9-15,39,42-50`
- Modify: `src/__tests__/toggle-stat-buttons.test.ts`

- [ ] **Step 1: Write paired toggle tests**

In `src/__tests__/toggle-stat-buttons.test.ts`, add new test cases after the existing ones:

```typescript
describe('computeSummary with paired entries', () => {
  const entries = [
    { label: 'Income', value: '1000 zł', amount: 1000, borderColor: 'green' },
    { label: 'Labor', value: '-200 zł', amount: -200, borderColor: 'orange' },
    { label: 'Payouts', value: '-150 zł', amount: -150, borderColor: 'pink' },
  ] as const

  it('excludes defaultHidden entry when it is in the hidden set', () => {
    const hidden = new Set(['Payouts'])
    expect(computeSummary(entries, hidden)).toBe(800) // 1000 - 200
  })

  it('includes defaultHidden entry and excludes its pair when swapped', () => {
    const hidden = new Set(['Labor'])
    expect(computeSummary(entries, hidden)).toBe(850) // 1000 - 150
  })
})
```

- [ ] **Step 2: Write buildToggleResult helper tests**

Add tests for the new `buildToggleResult` helper. This function takes `(label, hiddenSet, pairedWith?)` and returns a new Set:

```typescript
import { computeSummary, buildToggleResult } from '@/components/ui/toggle-stat-buttons'

describe('buildToggleResult', () => {
  it('clicking hidden paired card: shows it, hides its pair', () => {
    const hidden = new Set(['Payouts'])
    const result = buildToggleResult('Payouts', hidden, 'Labor')
    expect(result.has('Payouts')).toBe(false) // now visible
    expect(result.has('Labor')).toBe(true) // now hidden
  })

  it('clicking visible paired card: no-op', () => {
    const hidden = new Set(['Payouts'])
    const result = buildToggleResult('Labor', hidden, 'Payouts')
    // Labor is already visible, no change
    expect(result.has('Labor')).toBe(false)
    expect(result.has('Payouts')).toBe(true)
  })

  it('non-paired card: normal toggle on', () => {
    const hidden = new Set<string>()
    const result = buildToggleResult('Income', hidden, undefined)
    expect(result.has('Income')).toBe(true)
  })

  it('non-paired card: normal toggle off', () => {
    const hidden = new Set(['Income'])
    const result = buildToggleResult('Income', hidden, undefined)
    expect(result.has('Income')).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/toggle-stat-buttons.test.ts`
Expected: FAIL — `buildToggleResult` is not exported

- [ ] **Step 4: Add pairedWith, defaultHidden to StatEntryT**

In `src/components/ui/toggle-stat-buttons.tsx`, update the type:

```typescript
type StatEntryT = {
  readonly label: string
  readonly value: string
  readonly amount: number
  readonly borderColor: string
  readonly valueClassName?: string
  readonly pairedWith?: string
  readonly defaultHidden?: boolean
}
```

- [ ] **Step 5: Implement buildToggleResult and update toggle function**

Add the exported helper function:

```typescript
export function buildToggleResult(
  label: string,
  prev: ReadonlySet<string>,
  pairedWith: string | undefined,
): Set<string> {
  const next = new Set(prev)

  if (pairedWith) {
    // Paired toggle: if clicking a hidden card, show it and hide its pair
    if (next.has(label)) {
      next.delete(label)
      next.add(pairedWith)
    }
    // If clicking a visible paired card, no-op
    return next
  }

  // Non-paired: normal toggle
  if (next.has(label)) next.delete(label)
  else next.add(label)
  return next
}
```

Update the `hidden` state initialization to respect `defaultHidden`. **Important:** move `const allEntries = rows.flat()` above the `useState` call (currently it's after `useState` in the original code):

```typescript
const allEntries = rows.flat()

const [hidden, setHidden] = useState<Set<string>>(
  () => new Set(allEntries.filter((e) => e.defaultHidden).map((e) => e.label)),
)
```

Update the `toggle` function:

```typescript
function toggle(label: string) {
  const entry = allEntries.find((e) => e.label === label)
  setHidden((prev) => buildToggleResult(label, prev, entry?.pairedWith))

  // Fire onToggle for both cards in a paired swap to keep Zustand store in sync
  onToggle?.(label)
  if (entry?.pairedWith) onToggle?.(entry.pairedWith)
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/toggle-stat-buttons.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/toggle-stat-buttons.tsx src/__tests__/toggle-stat-buttons.test.ts
git commit -m "feat: add paired toggle and defaultHidden to stat buttons"
```

---

### Task 5: FinancialStats — propagate pairedWith & add Wypłaty color

**Files:**

- Modify: `src/components/investments/financial-stats.tsx:13-16,46-56`
- Modify: `src/stores/header-fields-store.ts:9-18`

- [ ] **Step 1: Add Wypłaty to FIXED_FIELD_COLORS**

In `src/components/investments/financial-stats.tsx`, update the color map:

```typescript
const FIXED_FIELD_COLORS: Record<string, string> = {
  [EXPENSE_LABEL]: 'var(--color-chart-orange)',
  Wypłaty: 'var(--color-chart-pink)',
  [INCOME_LABEL]: 'var(--color-chart-green)',
}
```

If `--color-chart-pink` doesn't exist in the theme, use `var(--color-chart-red)` or another available color. Check `src/app/globals.css` or the Tailwind config for available chart colors.

- [ ] **Step 2: Propagate pairedWith and defaultHidden in the mapping**

Update the entries mapping (line 46-56):

```typescript
const entries: StatEntryT[] = displayFields.map((field) => {
  const borderColor =
    FIXED_FIELD_COLORS[field.label] ?? CATEGORY_PALETTE[paletteIndex++ % CATEGORY_PALETTE.length]

  return {
    label: field.label,
    value: field.value,
    amount: field.amount ?? 0,
    borderColor,
    pairedWith: field.pairedWith,
    defaultHidden: field.defaultHidden,
  }
})
```

- [ ] **Step 3: Update Zustand store reset to accept default hidden labels**

In `src/stores/header-fields-store.ts`, update `reset` to accept default visibility:

```typescript
type HeaderFieldsStoreT = {
  visibility: Record<string, boolean>
  toggle: (label: string) => void
  reset: (defaultHidden?: string[]) => void
}

export const useHeaderFieldsStore = create<HeaderFieldsStoreT>()((set) => ({
  visibility: {},

  toggle: (label) =>
    set((state) => ({
      visibility: { ...state.visibility, [label]: !(state.visibility[label] ?? true) },
    })),

  reset: (defaultHidden) =>
    set({
      visibility: defaultHidden
        ? Object.fromEntries(defaultHidden.map((label) => [label, false]))
        : {},
    }),
}))
```

- [ ] **Step 4: Update FinancialStats to pass defaultHidden labels on reset**

In `src/components/investments/financial-stats.tsx`, update the reset call:

```typescript
const defaultHiddenLabels = fields.filter((f) => f.defaultHidden).map((f) => f.label)

useEffect(() => {
  reset(defaultHiddenLabels.length > 0 ? defaultHiddenLabels : undefined)
}, [reset])
```

Note: `defaultHiddenLabels` will be `['Wypłaty']` — this is a stable value derived from server props, so the dependency array warning is acceptable. If the linter complains, extract as a ref or memoize.

- [ ] **Step 5: Commit**

```bash
git add src/components/investments/financial-stats.tsx src/stores/header-fields-store.ts
git commit -m "feat: propagate pairedWith to stat entries, sync default-hidden with Zustand"
```

---

### Task 6: Report chart — add Wypłaty slice

**Files:**

- Modify: `src/components/reports/report-charts.tsx:37-41`

- [ ] **Step 1: Add Wypłaty slice to pie chart data**

In `src/components/reports/report-charts.tsx`, update the data array (line 37-41):

```typescript
const data = [
  ...categorySlices,
  { name: 'Robocizna', value: financials.totalLaborCosts, fill: 'var(--color-chart-yellow)' },
  { name: 'Wypłaty', value: financials.totalPayouts, fill: 'var(--color-chart-pink)' },
  { name: 'Wpływy', value: financials.totalIncome, fill: 'var(--color-chart-green)' },
]
```

Use the same color as the stat card for consistency.

- [ ] **Step 2: Commit**

```bash
git add src/components/reports/report-charts.tsx
git commit -m "feat: add Wypłaty slice to report pie chart"
```

---

### Task 7: Dashboard — add totalPayouts to investment rows

**Files:**

- Modify: `src/lib/queries/dashboard.ts:37-54`
- Modify: `src/__tests__/dashboard-aggregation.test.ts:65-68,92-105`

- [ ] **Step 1: Update dashboard test mock to include totalPayouts**

In `src/__tests__/dashboard-aggregation.test.ts`, update `fetchInvestmentFinancials` mock (line 65-68):

```typescript
fetchInvestmentFinancials: vi.fn().mockResolvedValue({
  '10': { categoryCosts: [], totalMaterialCosts: 2000, totalIncome: 8000, totalLaborCosts: 500, totalPayouts: 300 },
}),
```

The balance calculation test (line 93-98) should still pass because dashboard balance uses `totalIncome - totalMaterialCosts - totalLaborCosts` (not payouts). No test change needed for the balance assertion.

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test -- src/__tests__/dashboard-aggregation.test.ts`
Expected: PASS — the mock just has an extra field, dashboard doesn't use it yet

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/dashboard-aggregation.test.ts
git commit -m "test: update dashboard mock to include totalPayouts"
```

---

### Task 8: Full test run & cleanup

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 4: Fix any issues found in steps 1-3**

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git commit -m "fix: address lint/type issues from payouts tracking feature"
```
