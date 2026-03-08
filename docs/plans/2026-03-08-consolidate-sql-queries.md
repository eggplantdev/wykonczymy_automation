# Plan: Consolidate specialized SQL queries into generic path

## Problem

`src/lib/db/sum-transfers.ts` has 5 specialized single-entity SQL functions that duplicate what the generic `sumFilteredByType` + `buildSqlConditions` + `deriveFinancials` path already handles. This adds maintenance cost — business logic (which types = costs, which = income) is duplicated across functions.

## Candidates for removal

| Function                   | Real callers            | Status                                                |
| -------------------------- | ----------------------- | ----------------------------------------------------- |
| `sumInvestmentCosts`       | 0 (only tests)          | Dead code — delete                                    |
| `sumInvestmentIncome`      | 0 (only tests)          | Dead code — delete                                    |
| `sumFilteredFinancials`    | 1 (`reference-data.ts`) | Replace with `sumFilteredByType` + `deriveFinancials` |
| `sumEmployeeSaldo`         | 1 (`settlements.ts`)    | Replace with `sumFilteredByType` + derive             |
| `sumWorkerPeriodBreakdown` | 1 (`users.ts`)          | Replace with `sumFilteredByType` + derive             |

## NOT touched (different purpose)

- `sumRegisterBalance` — unique source/target subquery logic, used in hooks
- `sumAllRegisterBalances` — batch GROUP BY for dashboard
- `sumAllInvestmentFinancials` — batch GROUP BY for dashboard
- `sumAllWorkerSaldos` — batch GROUP BY for dashboard

## New derive function needed

`sumWorkerPeriodBreakdown` returns `{ totalAdvances, totalExpenses, periodSaldo }` which maps to `ACCOUNT_FUNDING` and `EMPLOYEE_EXPENSE` types. Need a new:

```typescript
export function deriveWorkerBreakdown(byType: readonly TypeTotalT[]): WorkerPeriodBreakdownT {
  const totalByType = (transferType: string) =>
    byType.find((row) => row.type === transferType)?.total ?? 0
  const advances = totalByType('ACCOUNT_FUNDING')
  const expenses = totalByType('EMPLOYEE_EXPENSE')
  return { totalAdvances: advances, totalExpenses: expenses, periodSaldo: advances - expenses }
}
```

`sumEmployeeSaldo` returns a single number (advances - expenses). Can reuse `deriveWorkerBreakdown` and extract `.periodSaldo`.

## Implementation steps

### Step 1: Delete dead code

- Remove `sumInvestmentCosts` and `sumInvestmentIncome` from `sum-transfers.ts`
- Remove their tests from `sum-transfers.test.ts`
- Files: `sum-transfers.ts`, `sum-transfers.test.ts`

### Step 2: Replace `sumFilteredFinancials`

- In `reference-data.ts`: replace `sumFilteredFinancials(payload, where)` with `sumFilteredByType(payload, where)` then `deriveFinancials(result)`
- Remove `sumFilteredFinancials` from `sum-transfers.ts`
- Update tests: remove `sumFilteredFinancials` unit tests, keep the `buildSqlConditions` filter translation tests (they test through `sumFilteredByType` anyway)
- Files: `sum-transfers.ts`, `reference-data.ts`, `sum-transfers.test.ts`

### Step 3: Replace `sumWorkerPeriodBreakdown`

- Add `deriveWorkerBreakdown()` to `sum-transfers.ts`
- In `users.ts`: build a Where clause for worker + date range, call `sumFilteredByType` + `deriveWorkerBreakdown`
- Remove `sumWorkerPeriodBreakdown` from `sum-transfers.ts`
- Update tests
- Files: `sum-transfers.ts`, `users.ts`, `sum-transfers.test.ts`

### Step 4: Replace `sumEmployeeSaldo`

- In `settlements.ts`: build a Where clause for worker (+ optional date range), call `sumFilteredByType` + `deriveWorkerBreakdown` then extract `.periodSaldo`
- Remove `sumEmployeeSaldo` from `sum-transfers.ts`
- Update tests in `sum-transfers.test.ts` and `settlement-actions.test.ts`
- Files: `sum-transfers.ts`, `settlements.ts`, `sum-transfers.test.ts`, `settlement-actions.test.ts`

## Tradeoffs

**Pro:** Single source of truth for type-to-category mapping. Adding a new transfer type only requires updating derive functions, not N SQL queries.

**Con:** Generic path uses `sql.raw()` with string interpolation (via `buildSqlConditions`) instead of parameterized `sql` template tags. The specialized functions use parameterized queries which are inherently safer. However, `buildSqlConditions` has its own escaping layer + values come from validated enums.

**Con:** Slight performance overhead — `sumFilteredByType` returns all type groups, while specialized queries only scan relevant types. In practice negligible for this data volume.

## Note on `sumEmployeeSaldo` in hooks context

`sumEmployeeSaldo` is called from `settlements.ts` (a server action), not from a Payload hook. So it doesn't need the `req` parameter for transaction-scoped DB access. The generic `sumFilteredByType` path doesn't support `req` — this is fine for the settlements use case.

If a hook ever needs single-entity saldo, a new specialized function would be warranted. Don't over-generalize.
