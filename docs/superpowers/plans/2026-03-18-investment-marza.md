# Investment Marża — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the paired toggle mechanism with a simple Marża (margin) display: remove pairedWith/defaultHidden, show Wypłaty and Marża as non-toggleable summary lines below Bilans, fix dashboard Koszty column, add Marża column to dashboard table.

**Architecture:** Remove toggle pairing from UI components and types. Keep totalPayouts in the data layer (already correct). Compute Marża as `Bilans - totalPayouts` in two places: (1) FinancialStats reads Zustand visibility + calls computeSummary to derive Bilans dynamically, then subtracts totalPayouts; (2) Dashboard computes it server-side.

**Tech Stack:** Next.js 16, Payload CMS, Zustand, Vitest, TanStack Table

**Spec:** `docs/superpowers/specs/2026-03-18-investment-marza-design.md`

---

## File Map

| File                                             | Action  | Responsibility                                                                               |
| ------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------- |
| `src/types/export.ts`                            | Modify  | Remove pairedWith, defaultHidden from HeaderFieldT; add totalPayouts to TransferTableConfigT |
| `src/components/ui/toggle-stat-buttons.tsx`      | Modify  | Remove buildToggleResult, pairedWith, defaultHidden from StatEntryT and component logic      |
| `src/stores/header-fields-store.ts`              | Modify  | Remove defaultHidden param from reset()                                                      |
| `src/lib/map-category-costs.ts`                  | Modify  | Remove Wypłaty entry, remove pairedWith from Koszty robocizny                                |
| `src/components/investments/financial-stats.tsx` | Rewrite | Flat single row, add Wypłaty + Marża summary lines below Bilans                              |
| `src/lib/tables/investments.tsx`                 | Modify  | Add totalCosts, totalPayouts, marza to InvestmentRowT; fix Koszty column; add Marża column   |
| `src/lib/queries/dashboard.ts`                   | Modify  | Compute totalCosts, pass totalPayouts, compute marza                                         |
| `src/components/transfers/print-button.tsx`      | Modify  | Append Wypłaty + Marża lines to print output                                                 |
| `src/app/(frontend)/inwestycje/[id]/page.tsx`    | Modify  | Pass totalPayouts to FinancialStats and TransferTableConfigT                                 |
| `src/app/(frontend)/raporty/page.tsx`            | Modify  | Pass totalPayouts to FinancialStats and TransferTableConfigT                                 |
| `src/__tests__/toggle-stat-buttons.test.ts`      | Modify  | Remove buildToggleResult and paired toggle tests                                             |
| `src/__tests__/dashboard-aggregation.test.ts`    | Modify  | Add totalCosts, totalPayouts, marza assertions                                               |

---

### Task 1: Remove paired toggle from types, store, buildFinancialFields, and tests

This task bundles type changes with their dependents to avoid intermediate type errors.

**Files:**

- Modify: `src/types/export.ts:6-12`
- Modify: `src/stores/header-fields-store.ts:1-24`
- Modify: `src/lib/map-category-costs.ts:19-42`
- Modify: `src/__tests__/toggle-stat-buttons.test.ts:1-76`

- [ ] **Step 1: Remove pairedWith and defaultHidden from HeaderFieldT**

In `src/types/export.ts`, update the type:

```typescript
export type HeaderFieldT = {
  readonly label: string
  readonly value: string
  readonly amount?: number
}
```

- [ ] **Step 2: Remove Wypłaty and pairedWith from buildFinancialFields**

In `src/lib/map-category-costs.ts`, replace lines 19-42 (the entire `buildFinancialFields` function):

```typescript
export function buildFinancialFields(
  financials: InvestmentFinancialsT,
  expenseCategories: readonly { readonly id: number; readonly name: string }[],
): HeaderFieldT[] {
  const { categoryCosts, totalIncome, totalLaborCosts } = financials

  return [
    ...mapCategoryCostsToFields(categoryCosts, expenseCategories),
    {
      label: 'Koszty robocizny',
      value: formatPLN(totalLaborCosts),
      amount: -totalLaborCosts,
    },
    { label: 'Wpłaty', value: formatPLN(totalIncome), amount: totalIncome },
  ]
}
```

- [ ] **Step 3: Simplify reset() in header-fields-store**

Replace `src/stores/header-fields-store.ts` content:

```typescript
import { create } from 'zustand'

type HeaderFieldsStoreT = {
  visibility: Record<string, boolean>
  toggle: (label: string) => void
  reset: () => void
}

export const useHeaderFieldsStore = create<HeaderFieldsStoreT>()((set) => ({
  visibility: {},

  toggle: (label) =>
    set((state) => ({
      visibility: { ...state.visibility, [label]: !(state.visibility[label] ?? true) },
    })),

  reset: () => set({ visibility: {} }),
}))
```

- [ ] **Step 4: Remove buildToggleResult tests and paired entry tests**

Replace `src/__tests__/toggle-stat-buttons.test.ts` entirely:

```typescript
import { describe, it, expect } from 'vitest'
import { computeSummary } from '@/components/ui/toggle-stat-buttons'

describe('computeSummary', () => {
  const entries = [
    { label: 'A', value: '100 zł', amount: 100, borderClassName: 'blue' },
    { label: 'B', value: '-50 zł', amount: -50, borderClassName: 'red' },
    { label: 'C', value: '200 zł', amount: 200, borderClassName: 'green' },
  ] as const

  it('sums all amounts when nothing is hidden', () => {
    const hidden = new Set<string>()
    expect(computeSummary(entries, hidden)).toBe(250)
  })

  it('excludes hidden entries from sum', () => {
    const hidden = new Set(['B'])
    expect(computeSummary(entries, hidden)).toBe(300)
  })

  it('returns 0 when all entries are hidden', () => {
    const hidden = new Set(['A', 'B', 'C'])
    expect(computeSummary(entries, hidden)).toBe(0)
  })

  it('returns 0 for empty entries', () => {
    expect(computeSummary([], new Set())).toBe(0)
  })
})
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- src/__tests__/toggle-stat-buttons.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/export.ts src/stores/header-fields-store.ts src/lib/map-category-costs.ts src/__tests__/toggle-stat-buttons.test.ts
git commit -m "refactor: remove pairedWith/defaultHidden from types, store, and fields"
```

---

### Task 2: Remove buildToggleResult and paired logic from ToggleStatButtons

**Files:**

- Modify: `src/components/ui/toggle-stat-buttons.tsx:9-16,27-48,67-78`

- [ ] **Step 1: Remove pairedWith and defaultHidden from StatEntryT**

In `src/components/ui/toggle-stat-buttons.tsx`, update lines 9-16:

```typescript
type StatEntryT = {
  readonly label: string
  readonly value: string
  readonly amount: number
  readonly borderClassName: string
}
```

- [ ] **Step 2: Remove buildToggleResult function**

Delete lines 27-48 (the entire `buildToggleResult` export).

- [ ] **Step 3: Simplify toggle function and hidden state init**

Replace lines 67-78 with:

```typescript
const [hidden, setHidden] = useState<Set<string>>(() => new Set())

function toggle(label: string) {
  setHidden((prev) => {
    const next = new Set(prev)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    return next
  })
  onToggle?.(label)
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- src/__tests__/toggle-stat-buttons.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/toggle-stat-buttons.tsx
git commit -m "refactor: remove buildToggleResult and paired toggle from stat buttons"
```

---

### Task 3: Rewrite FinancialStats — flat row + Wypłaty/Marża summary lines

**Files:**

- Modify: `src/components/investments/financial-stats.tsx:1-61`

- [ ] **Step 1: Rewrite the component**

Replace entire file. Note: `ToggleStatButtons` already wraps in `<div className="mb-4 space-y-2">`, so use a fragment to avoid double margin.

```typescript
'use client'

import { useEffect } from 'react'
import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import { ToggleStatButtons, computeSummary } from '@/components/ui/toggle-stat-buttons'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { HeaderFieldT } from '@/types/export'
import { SaldoDisplay } from '@/components/ui/saldo-display'

const INCOME_LABEL = 'Wpłaty'

type FinancialStatsPropsT = {
  readonly fields: readonly HeaderFieldT[]
  readonly totalPayouts?: number
}

export function FinancialStats({ fields, totalPayouts }: FinancialStatsPropsT) {
  const toggle = useHeaderFieldsStore((s) => s.toggle)
  const reset = useHeaderFieldsStore((s) => s.reset)
  const visibility = useHeaderFieldsStore((s) => s.visibility)

  useEffect(() => {
    reset()
  }, [reset])

  const toEntry = (field: HeaderFieldT, borderClassName: string): StatEntryT => ({
    ...field,
    amount: field.amount ?? 0,
    borderClassName,
  })

  const entries = fields.map((f) =>
    f.label === INCOME_LABEL
      ? toEntry(f, 'border-chart-green')
      : toEntry(f, 'border-chart-blue'),
  )

  // Compute current Bilans from visibility state (mirrors ToggleStatButtons internal logic)
  const hidden = new Set(
    entries.filter((e) => visibility[e.label] === false).map((e) => e.label),
  )
  const bilans = computeSummary(entries, hidden)
  const marza = bilans - (totalPayouts ?? 0)

  return (
    <>
      <ToggleStatButtons
        rows={[entries]}
        summaryLabel="Bilans"
        onToggle={toggle}
        helpText="Saldo liczone jest dynamicznie jako suma wybranych kategorii oraz filtrów."
      />

      {totalPayouts !== undefined && (
        <div className="mb-4 space-y-1">
          <SaldoDisplay saldo={-totalPayouts} label="Wypłaty" />
          <SaldoDisplay saldo={marza} label="Marża" />
        </div>
      )}
    </>
  )
}
```

**Key decisions:**

- `totalPayouts` is optional — register stats don't have it, only investment/report pages pass it
- `entries` uses two colors: blue for costs, green for income (no more orange labor row)
- Bilans is computed by reading Zustand `visibility` + calling `computeSummary` directly
- Wypłaty and Marża render as `SaldoDisplay` lines below the toggle buttons
- Uses fragment (`<>`) to avoid double `mb-4` (ToggleStatButtons already has its own wrapper)
- `marza` computed without non-null assertion: `bilans - (totalPayouts ?? 0)`

- [ ] **Step 2: Run dev server and verify visually**

Run: `pnpm dev`
Navigate to an investment detail page. Verify:

- Single row of stat cards (no row labels)
- Bilans updates when toggling cards
- Wypłaty and Marża appear below Bilans
- Marża = Bilans - Wypłaty

- [ ] **Step 3: Commit**

```bash
git add src/components/investments/financial-stats.tsx
git commit -m "feat: rewrite FinancialStats with Wypłaty/Marża summary lines"
```

---

### Task 4: Pass totalPayouts from pages to FinancialStats and print config

**Files:**

- Modify: `src/types/export.ts:20-28`
- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx:52-82`
- Modify: `src/app/(frontend)/raporty/page.tsx:43-59`

- [ ] **Step 1: Add totalPayouts to TransferTableConfigT**

In `src/types/export.ts`, update lines 20-28:

```typescript
export type TransferTableConfigT = {
  readonly query: TransferQueryT
  readonly baseUrl: string
  readonly excludeColumns?: string[]
  readonly filters?: FilterConfigT
  readonly context?: ExportContextT
  readonly contextId?: number
  readonly headerFields?: HeaderFieldT[]
  readonly totalPayouts?: number
}
```

- [ ] **Step 2: Update investment detail page**

In `src/app/(frontend)/inwestycje/[id]/page.tsx`:

Update line 70 — pass `totalPayouts` to FinancialStats:

```typescript
      <FinancialStats
        fields={headerFields.filter((f) => f.amount !== undefined)}
        totalPayouts={financials.totalPayouts}
      />
```

Update the config object (lines 74-82) — add `totalPayouts`:

```typescript
        config={{
          query: { where: transferWhere, page, limit },
          baseUrl: `/inwestycje/${id}`,
          excludeColumns: ['investment'],
          filters: buildFilterConfig(refData, 'investments'),
          context: 'investment',
          contextId: investmentId,
          headerFields,
          totalPayouts: financials.totalPayouts,
        }}
```

- [ ] **Step 3: Update reports page**

In `src/app/(frontend)/raporty/page.tsx`:

Update line 50 — pass `totalPayouts`:

```typescript
      <FinancialStats
        fields={headerFields.filter((f) => f.amount !== undefined)}
        totalPayouts={financials.totalPayouts}
      />
```

Update the config object (lines 54-60) — add `totalPayouts`:

```typescript
        config={{
          query: { where: urlFilters, page, limit },
          baseUrl: '/raporty',
          filters: buildFilterConfig(refData),
          headerFields,
          totalPayouts: financials.totalPayouts,
        }}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/export.ts src/app/'(frontend)'/inwestycje/'[id]'/page.tsx src/app/'(frontend)'/raporty/page.tsx
git commit -m "feat: pass totalPayouts to FinancialStats and print config"
```

---

### Task 5: Update print-button to show Wypłaty and Marża

**Files:**

- Modify: `src/components/transfers/print-button.tsx:31-32`

- [ ] **Step 1: Append Wypłaty and Marża to print output**

In `src/components/transfers/print-button.tsx`, replace lines 31-32 (the `bilans` calculation and `visibleHeaderFields` assignment):

```typescript
const bilans = calculateBilans(headerFields, storeVisibility)
const printFields = [...visibleFields, { label: BILANS_LABEL, value: formatPLN(bilans) }]

const totalPayouts = config.totalPayouts
const visibleHeaderFields =
  totalPayouts !== undefined
    ? [
        ...printFields,
        { label: 'Wypłaty', value: formatPLN(-totalPayouts) },
        { label: 'Marża', value: formatPLN(bilans - totalPayouts) },
      ]
    : printFields
```

- [ ] **Step 2: Commit**

```bash
git add src/components/transfers/print-button.tsx
git commit -m "feat: add Wypłaty and Marża to print output"
```

---

### Task 6: Fix dashboard — Koszty column, add Marża column

**Files:**

- Modify: `src/lib/queries/dashboard.ts:37-55`
- Modify: `src/lib/tables/investments.tsx:9-44`

- [ ] **Step 1: Update dashboard test expectations first**

In `src/__tests__/dashboard-aggregation.test.ts`, update the balance test (lines 98-104):

```typescript
describe('investment balance calculation', () => {
  it('calculates balance, totalCosts, and marza correctly', async () => {
    const data = await fetchManagerDashboardData()
    const invA = data.allInvestments.find((i) => i.id === 10)!
    // balance: 8000 - 2000 - 500 = 5500
    expect(invA.balance).toBe(5500)
    // totalCosts: 2000 + 500 = 2500
    expect(invA.totalCosts).toBe(2500)
    // totalPayouts: 300
    expect(invA.totalPayouts).toBe(300)
    // marza: 5500 - 300 = 5200
    expect(invA.marza).toBe(5200)
  })

  it('defaults missing financials to 0', async () => {
    const data = await fetchManagerDashboardData()
    const invB = data.allInvestments.find((i) => i.id === 20)!
    expect(invB.balance).toBe(0)
    expect(invB.totalCosts).toBe(0)
    expect(invB.totalPayouts).toBe(0)
    expect(invB.marza).toBe(0)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm test -- src/__tests__/dashboard-aggregation.test.ts`
Expected: FAIL — `totalCosts`, `totalPayouts`, `marza` not on type

- [ ] **Step 3: Update InvestmentRowT and dashboard query**

In `src/lib/tables/investments.tsx`, update the type (lines 9-21):

```typescript
export type InvestmentRowT = {
  readonly id: number
  readonly name: string
  readonly status: 'active' | 'completed'
  readonly totalCosts: number
  readonly totalMaterialCosts: number
  readonly totalIncome: number
  readonly totalLaborCosts: number
  readonly totalPayouts: number
  readonly balance: number
  readonly marza: number
  readonly address: string
  readonly phone: string
  readonly email: string
  readonly contactPerson: string
}
```

In `src/lib/queries/dashboard.ts`, update the mapping (lines 37-55):

```typescript
const allInvestments: InvestmentRowT[] = refData.investments.map((inv) => {
  const fin = financialsRecord[String(inv.id)]
  const totalMaterialCosts = fin?.totalMaterialCosts ?? 0
  const totalIncome = fin?.totalIncome ?? 0
  const totalLaborCosts = fin?.totalLaborCosts ?? 0
  const totalPayouts = fin?.totalPayouts ?? 0
  const totalCosts = totalMaterialCosts + totalLaborCosts
  const balance = totalIncome - totalCosts
  return {
    id: inv.id,
    name: inv.name,
    status: inv.status,
    totalCosts,
    totalMaterialCosts,
    totalIncome,
    totalLaborCosts,
    totalPayouts,
    balance,
    marza: balance - totalPayouts,
    address: inv.address,
    phone: inv.phone,
    email: inv.email,
    contactPerson: inv.contactPerson,
  }
})
```

- [ ] **Step 4: Fix Koszty column and add Marża column**

In `src/lib/tables/investments.tsx`, update the columns:

Replace the `totalMaterialCosts` accessor (lines 33-38) with:

```typescript
    col.accessor('totalCosts', {
      id: 'totalCosts',
      header: 'Koszty',
      meta: { align: 'right' },
      cell: (info) => <span className="font-medium">{formatPLN(info.getValue())}</span>,
    }),
```

After the balance column (line 44), add:

```typescript
    col.accessor('marza', {
      id: 'marza',
      header: 'Marża',
      meta: { align: 'right' },
      cell: (info) => <BalanceCell value={info.getValue()} />,
    }),
```

- [ ] **Step 5: Run tests**

Run: `pnpm test -- src/__tests__/dashboard-aggregation.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/tables/investments.tsx src/lib/queries/dashboard.ts src/__tests__/dashboard-aggregation.test.ts
git commit -m "feat: fix dashboard Koszty column, add Marża column"
```

---

### Task 7: Full verification

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
git commit -m "fix: address lint/type issues from Marża feature"
```
