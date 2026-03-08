# Transactions Report Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/transakcje` page (Admin/Owner only) with the full transfers table, all filters (including new: worker, payment method, category), and dynamic stat cards calculated server-side via SQL aggregation.

**Architecture:** Extend existing `buildTransferFilters()` with 3 new filter params (worker, paymentMethod, otherCategory). Extend `TransferFilters` component and `FilterConfigT` to render them. Add a new `sumFilteredFinancials()` SQL function that accepts a Payload `Where` clause translated to raw SQL conditions. The page reuses `PageWrapper`, `TransfersSection`, and all existing table/export components.

**Tech Stack:** Next.js App Router, Payload CMS, Vercel Postgres (raw SQL), TanStack React Table, Zustand, Vitest

---

### Task 1: Create feature branch

**Step 1: Create and switch to branch**

Run: `git checkout -b feat/transactions-report`

**Step 2: Verify branch**

Run: `git branch --show-current`
Expected: `feat/transactions-report`

---

### Task 2: Extend `buildTransferFilters()` with new filter params

**Files:**

- Modify: `src/lib/queries/transfers.ts:57-114`
- Test: `src/__tests__/build-transfer-filters.test.ts`

**Step 1: Write failing tests for new filters**

Add to `src/__tests__/build-transfer-filters.test.ts` inside the "search params" describe block:

```ts
it('worker param adds numeric filter', () => {
  const where = buildTransferFilters({ worker: '10' }, managerCtx)
  expect(where.worker).toEqual({ in: [10] })
})

it('worker param supports multi-select', () => {
  const where = buildTransferFilters({ worker: '10,20' }, managerCtx)
  expect(where.worker).toEqual({ in: [10, 20] })
})

it('worker param with invalid value returns no results', () => {
  const where = buildTransferFilters({ worker: 'abc' }, managerCtx)
  expect(where.id).toEqual({ equals: -1 })
})

it('employee worker filter takes precedence over worker param', () => {
  const where = buildTransferFilters({ worker: '10' }, employeeCtx)
  expect(where.worker).toEqual({ equals: 5 })
})

it('paymentMethod param adds filter', () => {
  const where = buildTransferFilters({ paymentMethod: 'CASH' }, managerCtx)
  expect(where.paymentMethod).toEqual({ in: ['CASH'] })
})

it('paymentMethod param with invalid value returns no results', () => {
  const where = buildTransferFilters({ paymentMethod: 'INVALID' }, managerCtx)
  expect(where.id).toEqual({ equals: -1 })
})

it('otherCategory param adds numeric filter', () => {
  const where = buildTransferFilters({ otherCategory: '3' }, managerCtx)
  expect(where.otherCategory).toEqual({ in: [3] })
})

it('otherCategory param supports multi-select', () => {
  const where = buildTransferFilters({ otherCategory: '3,5' }, managerCtx)
  expect(where.otherCategory).toEqual({ in: [3, 5] })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/build-transfer-filters.test.ts`
Expected: FAIL — new filter params are not handled yet

**Step 3: Implement new filter params in `buildTransferFilters()`**

In `src/lib/queries/transfers.ts`, add after the `createdBy` filter block (after line 103) and before the date range block:

```ts
// Worker filter — skip for employees (they already have worker scoped above)
if (userContext.isManager) {
  const workerParam = getStringParam(searchParams.worker)
  const workerIds = parseNumericIds(workerParam)
  if (workerIds.length > 0) where.worker = { in: workerIds }
  else if (workerParam) where.id = NO_RESULTS
}

// Payment method filter (validates against known methods)
const paymentMethodParam = getStringParam(searchParams.paymentMethod)
if (paymentMethodParam) {
  const methods = paymentMethodParam
    .split(',')
    .filter((m) => (PAYMENT_METHODS as readonly string[]).includes(m))
  if (methods.length > 0) where.paymentMethod = { in: methods }
  else where.id = NO_RESULTS
}

// Other category filter
const otherCategoryParam = getStringParam(searchParams.otherCategory)
const otherCategoryIds = parseNumericIds(otherCategoryParam)
if (otherCategoryIds.length > 0) where.otherCategory = { in: otherCategoryIds }
else if (otherCategoryParam) where.id = NO_RESULTS
```

Add `PAYMENT_METHODS` to the imports from `@/lib/constants/transfers`.

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/build-transfer-filters.test.ts`
Expected: ALL PASS

**Step 5: Run /simplify**

**Step 6: Commit**

```bash
git add src/lib/queries/transfers.ts src/__tests__/build-transfer-filters.test.ts
git commit -m "feat: extend buildTransferFilters with worker, paymentMethod, otherCategory params"
```

---

### Task 3: Extend `FilterConfigT` and `TransferFilters` component

**Files:**

- Modify: `src/types/filters.ts`
- Modify: `src/components/transfers/transfer-filters.tsx`

**Step 1: Extend `FilterConfigT`**

In `src/types/filters.ts`, add new optional fields:

```ts
export type FilterConfigT = {
  readonly cashRegisters?: { id: number; name: string }[]
  readonly investments?: { id: number; name: string }[]
  readonly users?: { id: number; name: string }[]
  readonly workers?: { id: number; name: string }[]
  readonly otherCategories?: { id: number; name: string }[]
  readonly showTypeFilter?: boolean
  readonly showPaymentMethodFilter?: boolean
}
```

**Step 2: Add new filters to `TransferFilters` component**

In `src/components/transfers/transfer-filters.tsx`:

1. Add to props type: `workers`, `otherCategories`, `showPaymentMethodFilter` (from `TransferFiltersPropsT`)
2. Add state readers for new URL params:
   ```ts
   const currentWorkers = getMultiParam('worker')
   const currentPaymentMethods = getMultiParam('paymentMethod')
   const currentOtherCategories = getMultiParam('otherCategory')
   ```
3. Add `FilterMultiSelect` components for each new filter (after existing ones, before the clear button)
4. Update `hasEntityFilters` to include the new params
5. Update `clearEntityFilters` to clear new params too
6. Import `PAYMENT_METHODS`, `PAYMENT_METHOD_LABELS` from `@/lib/constants/transfers`
7. Use appropriate icons: `User` for workers (already imported), `CreditCard` for payment method, `FolderOpen` for category

**Step 3: Run /simplify**

**Step 4: Commit**

```bash
git add src/types/filters.ts src/components/transfers/transfer-filters.tsx
git commit -m "feat: add worker, paymentMethod, otherCategory filters to TransferFilters"
```

---

### Task 4: Add `sumFilteredFinancials()` SQL function

**Files:**

- Modify: `src/lib/db/sum-transfers.ts`
- Test: `src/__tests__/sum-transfers.test.ts`

**Step 1: Write failing tests**

Add to `src/__tests__/sum-transfers.test.ts`:

```ts
// ── sumFilteredFinancials ────────────────────────────────────────────

describe('sumFilteredFinancials', () => {
  it('returns totals from rows', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ total_costs: '5000', total_income: '12000', total_labor_costs: '800' }],
    })
    const result = await sumFilteredFinancials(fakePayload, {})
    expect(result).toEqual({ totalCosts: 5000, totalIncome: 12000, totalLaborCosts: 800 })
  })

  it('returns zeros when no matching transactions', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ total_costs: '0', total_income: '0', total_labor_costs: '0' }],
    })
    const result = await sumFilteredFinancials(fakePayload, {})
    expect(result).toEqual({ totalCosts: 0, totalIncome: 0, totalLaborCosts: 0 })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/__tests__/sum-transfers.test.ts`
Expected: FAIL — `sumFilteredFinancials` does not exist

**Step 3: Implement `sumFilteredFinancials()`**

In `src/lib/db/sum-transfers.ts`, add:

```ts
import type { Where } from 'payload'

/**
 * SUM costs, income, and labor costs for transactions matching a Payload Where clause.
 * Translates the Where clause to raw SQL conditions.
 * Returns aggregate totals — no GROUP BY, single result row.
 */
export const sumFilteredFinancials = async (
  payload: Payload,
  where: Where,
): Promise<InvestmentFinancialsT> => {
  const elapsed = perfStart()
  const db = await getDb(payload)

  const conditions = buildSqlConditions(where)

  const result = await db.execute(
    sql.raw(`
    SELECT
      COALESCE(SUM(CASE WHEN type IN ('INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE') THEN amount ELSE 0 END), 0) AS total_costs,
      COALESCE(SUM(CASE WHEN type IN ('INVESTOR_DEPOSIT') THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'LABOR_COST' THEN amount ELSE 0 END), 0) AS total_labor_costs
    FROM transactions
    WHERE cancelled IS NOT TRUE
      ${conditions}
  `),
  )

  console.log(`[PERF] query.sumFilteredFinancials ${elapsed()}ms`)

  return {
    totalCosts: Number(result.rows[0].total_costs),
    totalIncome: Number(result.rows[0].total_income),
    totalLaborCosts: Number(result.rows[0].total_labor_costs),
  }
}
```

**Important — `buildSqlConditions()` helper:**

This function translates the Payload `Where` object into SQL `AND` clauses. Since `buildTransferFilters()` produces a flat object with known keys, the translation is straightforward:

```ts
/**
 * Translates a flat Payload Where object to SQL AND clauses.
 * Only handles the operators used by buildTransferFilters():
 *   { field: { equals: value } }
 *   { field: { in: values[] } }
 *   { field: { greater_than_equal: value } }
 *   { field: { less_than_equal: value } }
 *
 * Uses parameterized values via string escaping for safety.
 * Field names are mapped from Payload camelCase to SQL snake_case column names.
 */
const FIELD_TO_COLUMN: Record<string, string> = {
  type: 'type',
  sourceRegister: 'source_register_id',
  targetRegister: 'target_register_id',
  investment: 'investment_id',
  worker: 'worker_id',
  createdBy: 'created_by_id',
  otherCategory: 'other_category_id',
  paymentMethod: 'payment_method',
  date: 'date',
  cancelled: 'cancelled',
}

function buildSqlConditions(where: Where): string {
  const clauses: string[] = []

  for (const [field, condition] of Object.entries(where)) {
    if (field === 'id') continue // skip impossible-condition sentinel
    const column = FIELD_TO_COLUMN[field]
    if (!column || typeof condition !== 'object' || condition === null) continue

    const cond = condition as Record<string, unknown>

    if ('equals' in cond) {
      const val = cond.equals
      clauses.push(`AND ${column} = ${escapeValue(val)}`)
    }
    if ('in' in cond && Array.isArray(cond.in)) {
      const vals = cond.in.map(escapeValue).join(', ')
      clauses.push(`AND ${column} IN (${vals})`)
    }
    if ('greater_than_equal' in cond) {
      clauses.push(`AND ${column} >= ${escapeValue(cond.greater_than_equal)}`)
    }
    if ('less_than_equal' in cond) {
      clauses.push(`AND ${column} <= ${escapeValue(cond.less_than_equal)}`)
    }
  }

  return clauses.join('\n      ')
}

function escapeValue(val: unknown): string {
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
  return 'NULL'
}
```

> **Security note:** All values come from `buildTransferFilters()` which validates against known enums and parses numeric IDs. The `escapeValue` function provides SQL injection protection as a second layer. Consider using parameterized queries if this grows more complex.

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/__tests__/sum-transfers.test.ts`
Expected: ALL PASS

**Step 5: Add integration-style tests for `buildSqlConditions`**

Add to `src/__tests__/sum-transfers.test.ts`:

```ts
// ── buildSqlConditions (via sumFilteredFinancials) ───────────────────

describe('sumFilteredFinancials — filter translation', () => {
  it('passes type filter to SQL', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ total_costs: '0', total_income: '0', total_labor_costs: '0' }],
    })
    await sumFilteredFinancials(fakePayload, { type: { in: ['PAYOUT', 'OTHER'] } })
    const query = mockExecute.mock.calls[0][0]
    expect(query.queryChunks?.[0] ?? query.toString?.() ?? String(query)).toContain(
      "type IN ('PAYOUT', 'OTHER')",
    )
  })

  it('passes date range to SQL', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ total_costs: '0', total_income: '0', total_labor_costs: '0' }],
    })
    await sumFilteredFinancials(fakePayload, {
      date: { greater_than_equal: '2024-01-01', less_than_equal: '2024-12-31' },
    })
    const query = mockExecute.mock.calls[0][0]
    const queryStr = query.queryChunks?.[0] ?? query.toString?.() ?? String(query)
    expect(queryStr).toContain("date >= '2024-01-01'")
    expect(queryStr).toContain("date <= '2024-12-31'")
  })

  it('passes investment filter to SQL', async () => {
    mockExecute.mockResolvedValue({
      rows: [{ total_costs: '0', total_income: '0', total_labor_costs: '0' }],
    })
    await sumFilteredFinancials(fakePayload, { investment: { in: [5] } })
    const query = mockExecute.mock.calls[0][0]
    expect(query.queryChunks?.[0] ?? query.toString?.() ?? String(query)).toContain(
      'investment_id IN (5)',
    )
  })
})
```

> **Note:** The exact way to inspect the SQL string depends on how `sql.raw()` works in your drizzle setup. You may need to adjust the query extraction. Check `mockExecute.mock.calls[0][0]` in a debugger first.

**Step 6: Run all tests**

Run: `pnpm test -- src/__tests__/sum-transfers.test.ts`
Expected: ALL PASS

**Step 7: Run /simplify**

**Step 8: Commit**

```bash
git add src/lib/db/sum-transfers.ts src/__tests__/sum-transfers.test.ts
git commit -m "feat: add sumFilteredFinancials with Where-to-SQL translation"
```

---

### Task 5: Add `fetchFilteredFinancials()` cached query

**Files:**

- Modify: `src/lib/queries/reference-data.ts`

**Step 1: Add the cached wrapper**

In `src/lib/queries/reference-data.ts`, add:

```ts
import type { Where } from 'payload'
import { sumFilteredFinancials } from '@/lib/db/sum-transfers'

export async function fetchFilteredFinancials(where: Where) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const elapsed = perfStart()
  const payload = await getPayload({ config })
  const result = await sumFilteredFinancials(payload, where)
  console.log(`[PERF] query.fetchFilteredFinancials ${elapsed()}ms`)
  return result
}
```

> **Note:** Caching by `Where` object means different filter combos get separate cache entries. This is fine — the cache is invalidated on any transfer mutation via `CACHE_TAGS.transfers`.

**Step 2: Run /simplify**

**Step 3: Commit**

```bash
git add src/lib/queries/reference-data.ts
git commit -m "feat: add fetchFilteredFinancials cached query wrapper"
```

---

### Task 6: Create the `/transakcje` page

**Files:**

- Create: `src/app/(frontend)/transakcje/page.tsx`

**Step 1: Create the page**

```tsx
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { fetchReferenceData, fetchFilteredFinancials } from '@/lib/queries/reference-data'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { perfStart } from '@/lib/perf'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InvestmentStats } from '@/components/investments/investment-stats'
import { BILANS_LABEL } from '@/lib/export/header-fields'
import type { HeaderFieldT } from '@/types/export'
import type { DynamicPagePropsT } from '@/types/page'

export default async function TransactionsReportPage({ searchParams }: DynamicPagePropsT) {
  const session = await requireAuth(ADMIN_OR_OWNER_ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session

  const step = perfStart()

  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })

  const [refData, financials] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredFinancials(urlFilters),
  ])
  console.log(`[PERF] transakcje fetchReferenceData + fetchFilteredFinancials ${step()}ms`)

  const { totalCosts, totalIncome, totalLaborCosts } = financials

  const headerFields: HeaderFieldT[] = [
    { label: 'Transakcje', value: 'Raport' },
    { label: 'Koszty', value: formatPLN(totalCosts), amount: -totalCosts },
    { label: 'Wpływy', value: formatPLN(totalIncome), amount: totalIncome },
    { label: 'Koszty robocizny', value: formatPLN(totalLaborCosts), amount: -totalLaborCosts },
    {
      label: BILANS_LABEL,
      value: formatPLN(totalIncome - totalCosts - totalLaborCosts),
    },
  ]

  return (
    <PageWrapper
      title="Transakcje"
      backHref="/"
      backLabel="Pulpit"
      className="grid grid-cols-1 gap-6"
    >
      <InvestmentStats
        fields={headerFields.filter((f) => f.amount !== undefined || f.label === BILANS_LABEL)}
      />

      <TransfersSection
        config={{
          query: { where: urlFilters, page, limit },
          baseUrl: '/transakcje',
          filters: {
            cashRegisters: refData.cashRegisters.map((c) => ({ id: c.id, name: c.name })),
            investments: refData.investments.map((i) => ({ id: i.id, name: i.name })),
            users: refData.workers.map((w) => ({ id: w.id, name: w.name })),
            workers: refData.workers.map((w) => ({ id: w.id, name: w.name })),
            otherCategories: refData.otherCategories.map((c) => ({ id: c.id, name: c.name })),
            showPaymentMethodFilter: true,
          },
          context: 'investment',
          headerFields,
        }}
      />
    </PageWrapper>
  )
}
```

> **Note:** `users` (created by) and `workers` (worker field) both use `refData.workers` but filter different DB columns. The `users` filter maps to `createdBy` param, `workers` to `worker` param.

> **Note:** The `context` prop may need a new value like `'report'` if `'investment'` triggers investment-specific behavior in export. Check `ExportContextT` and adjust if needed.

**Step 2: Run /simplify**

**Step 3: Commit**

```bash
git add src/app/\(frontend\)/transakcje/page.tsx
git commit -m "feat: add /transakcje report page with filtered stats"
```

---

### Task 7: Verify end-to-end in browser

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Manual verification checklist**

- [ ] Navigate to `/transakcje` — page loads with stat cards and table
- [ ] Non-admin/owner users get redirected to `/zaloguj`
- [ ] All filters render and update URL params
- [ ] New filters (worker, payment method, category) work
- [ ] Stat cards update when filters change (requires page reload since server component)
- [ ] Print/CSV export works
- [ ] Table pagination works

**Step 3: Run /simplify**

---

### Task 8: Write tests

**Files:**

- Test: `src/__tests__/transactions-report-filters.test.ts`

**Step 1: Write tests for the full filter → stats flow**

```ts
import { describe, it, expect } from 'vitest'
import { buildTransferFilters } from '@/lib/queries/transfers'

const adminCtx = { id: 1, isManager: true } as const

describe('transactions report — filter combinations', () => {
  it('all filters combined produce correct Where', () => {
    const where = buildTransferFilters(
      {
        type: 'INVESTMENT_EXPENSE',
        sourceRegister: '1',
        investment: '5',
        createdBy: '3',
        worker: '10',
        paymentMethod: 'CASH',
        otherCategory: '2',
        from: '2024-01-01',
        to: '2024-12-31',
      },
      adminCtx,
    )
    expect(where.type).toEqual({ in: ['INVESTMENT_EXPENSE'] })
    expect(where.sourceRegister).toEqual({ in: [1] })
    expect(where.investment).toEqual({ in: [5] })
    expect(where.createdBy).toEqual({ in: [3] })
    expect(where.worker).toEqual({ in: [10] })
    expect(where.paymentMethod).toEqual({ in: ['CASH'] })
    expect(where.otherCategory).toEqual({ in: [2] })
    expect(where.date).toEqual({
      greater_than_equal: '2024-01-01',
      less_than_equal: '2024-12-31',
    })
  })

  it('no filters returns empty where', () => {
    const where = buildTransferFilters({}, adminCtx)
    expect(where).toEqual({})
  })

  it('invalid paymentMethod returns no results', () => {
    const where = buildTransferFilters({ paymentMethod: 'BITCOIN' }, adminCtx)
    expect(where.id).toEqual({ equals: -1 })
  })

  it('multiple workers via comma-separated param', () => {
    const where = buildTransferFilters({ worker: '10,20,30' }, adminCtx)
    expect(where.worker).toEqual({ in: [10, 20, 30] })
  })

  it('multiple categories via comma-separated param', () => {
    const where = buildTransferFilters({ otherCategory: '1,2' }, adminCtx)
    expect(where.otherCategory).toEqual({ in: [1, 2] })
  })
})
```

**Step 2: Run tests**

Run: `pnpm test -- src/__tests__/transactions-report-filters.test.ts`
Expected: ALL PASS

**Step 3: Run /simplify**

**Step 4: Commit**

```bash
git add src/__tests__/transactions-report-filters.test.ts
git commit -m "test: add transactions report filter combination tests"
```

---

### Task 9: Run full test suite and lint

**Step 1: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 4: Fix any issues and commit**

---

### Task 10: Create PR

**Step 1: Push branch**

Run: `git push -u origin feat/transactions-report`

**Step 2: Create PR**

```bash
gh pr create --title "feat: add /transakcje report page" --body "$(cat <<'EOF'
## Summary
- New `/transakcje` page with full transfers table + dynamic stat cards (Admin/Owner only)
- Extended `buildTransferFilters()` with worker, payment method, and category filters
- New `sumFilteredFinancials()` SQL aggregate function for filter-aware stats
- Extended `TransferFilters` component with 3 new filter multi-selects

## Test plan
- [ ] New filter params tested in `build-transfer-filters.test.ts`
- [ ] `sumFilteredFinancials` tested in `sum-transfers.test.ts`
- [ ] Combined filter tests in `transactions-report-filters.test.ts`
- [ ] Manual: navigate to `/transakcje`, verify filters + stats + table
- [ ] Manual: verify non-admin users get redirected

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
