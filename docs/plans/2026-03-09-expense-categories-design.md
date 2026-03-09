# Expense Categories for Investment Transfers

**Date:** 2026-03-09
**Status:** Approved

## Problem

Investment costs are tracked as a single `totalCosts` bucket (INVESTMENT_EXPENSE + EMPLOYEE_EXPENSE). Business needs per-category breakdown (e.g., "Materiały budowlane", "Materiały wykończeniowe") with individual stat cards on investment and reports pages. Adding a new category should automatically generate a new stat card and appear in all relevant forms.

## Design

### New Collection: `expense-categories`

- `name: text` (required, unique)
- Access: `isAdminOrOwnerOrManager` (same as `other-categories`)
- Hooks: revalidate cache on change/delete
- Seed: "Materiały budowlane", "Materiały wykończeniowe"

### New Field on `transactions`

- `expenseCategory: relationship → expense-categories` (nullable)
- Required when `INVESTMENT_EXPENSE` or `EMPLOYEE_EXPENSE` with investment
- Not used for `LABOR_COST`, `OTHER`, or any other type
- Shown in Payload admin when applicable
- Existing rows backfilled with "Materiały budowlane" (default)

### Investment Page Stat Cards (after change)

| Card                             | Source                                                           |
| -------------------------------- | ---------------------------------------------------------------- |
| Materiały budowlane              | SUM where `expenseCategory` = "Materiały budowlane"              |
| Materiały wykończeniowe          | SUM where `expenseCategory` = "Materiały wykończeniowe"          |
| _(future categories auto-added)_ | Same pattern                                                     |
| **Koszty materiałowe (łącznie)** | SUM of all INVESTMENT_EXPENSE + EMPLOYEE_EXPENSE with investment |
| Koszty robocizny                 | SUM of LABOR_COST (unchanged)                                    |
| Wpłaty od inwestora              | SUM of INVESTOR_DEPOSIT (unchanged)                              |
| Bilans                           | income - material costs - labor                                  |

Reports page uses the same `InvestmentStats` component — gets dynamic stat cards automatically.

### Type Changes

```typescript
type CategoryCostT = {
  readonly categoryId: number
  readonly categoryName: string
  readonly total: number
}

type InvestmentFinancialsT = {
  readonly categoryCosts: readonly CategoryCostT[]
  readonly totalMaterialCosts: number // sum of all categoryCosts
  readonly totalIncome: number
  readonly totalLaborCosts: number
}
```

### SQL Changes

Per-category breakdown query:

```sql
SELECT investment_id, expense_category_id,
  SUM(amount) AS category_total
FROM transactions
WHERE investment_id IS NOT NULL
  AND cancelled IS NOT TRUE
  AND type IN ('INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE')
GROUP BY investment_id, expense_category_id
```

### Form Changes

- **Transfer form dialog**: show `ExpenseCategoryField` when `INVESTMENT_EXPENSE` or (`EMPLOYEE_EXPENSE` with expenseTarget = 'investment')
- **Settlement form dialog**: show `ExpenseCategoryField` in investment mode
- Both consume expense categories from reference data

### Files to Modify/Create

| Action | File                                                        |
| ------ | ----------------------------------------------------------- |
| Create | `src/collections/expense-categories.ts`                     |
| Create | `src/migrations/YYYYMMDD_add_expense_categories.ts`         |
| Modify | `src/payload.config.ts` (register collection)               |
| Modify | `src/lib/cache/tags.ts` (new cache tag)                     |
| Modify | `src/types/reference-data.ts` (add to ReferenceDataBaseT)   |
| Modify | `src/lib/queries/reference-data.ts` (fetch + cache)         |
| Modify | `src/collections/transfers.ts` (new field)                  |
| Modify | `src/hooks/transfers/validate.ts` (require expenseCategory) |
| Modify | `src/lib/constants/transfers.ts` (new predicate)            |
| Modify | `src/lib/tables/transfers.tsx` (new column + lookups)       |
| Modify | `src/lib/db/sum-transfers.ts` (per-category SQL + types)    |
| Modify | `src/components/forms/transfer-form/transfer-form.tsx`      |
| Modify | `src/components/forms/transfer-form/transfer-schema.ts`     |
| Modify | `src/components/forms/settlement-form/settlement-form.tsx`  |
| Modify | `src/app/(frontend)/inwestycje/[id]/page.tsx`               |
| Modify | `src/components/investments/investment-stats.tsx`           |
| Modify | `src/lib/actions/settlements.ts`                            |
| Modify | `src/lib/actions/transfers.ts`                              |
| Modify | Tests (multiple files)                                      |

### Constraints

- `LABOR_COST` stays standalone — no expense category
- Existing INVESTMENT_EXPENSE + EMPLOYEE_EXPENSE rows backfilled with default category
- Branch: `feat/expense-categories`
