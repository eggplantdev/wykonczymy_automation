# Transactions Report Page Design

## Overview

New `/transakcje` page (Admin/Owner only) — full transfers table with all available filters + dynamic stat cards that recalculate based on active filters.

## Page Structure

- Route: `src/app/(frontend)/transakcje/page.tsx`
- Uses `PageWrapper` and existing layout components
- Access: `requireAuth` with Admin/Owner roles only

## Stat Cards

- Total Income (sum of deposit types)
- Total Costs (sum of expense types)
- Total Labor Costs (sum of labor cost type)
- Bilans (income - costs - labor)
- Always visible, not toggleable
- Recalculate when any filter changes

## Stats Calculation — Server-Side SQL

New `sumFilteredStats(where)` function — accepts the same Payload `Where` clause used by the transfers table. Runs a `SUM(CASE WHEN ...)` aggregate query grouped by transfer type categories. Single DB round-trip, no row data transferred.

Pattern: same as existing `sumAllInvestmentFinancials` but with dynamic WHERE instead of `GROUP BY investment_id`.

Data flow:

```
URL params → buildTransferFilters() → WHERE clause
  ├→ findTransfersRaw(where, page, limit)  →  paginated table rows
  └→ sumFilteredStats(where)               →  { totalCosts, totalIncome, totalLaborCosts }
```

## Filters

Reuse and extend `TransfersSection` / `TransferFilters`:

| Filter                          | Status   | URL param        |
| ------------------------------- | -------- | ---------------- |
| Type                            | existing | `type`           |
| Cash register                   | existing | `sourceRegister` |
| Investment                      | existing | `investment`     |
| Created by                      | existing | `createdBy`      |
| Date range (year/month/from/to) | existing | `from`, `to`     |
| Worker                          | **new**  | `worker`         |
| Payment method                  | **new**  | `paymentMethod`  |
| Category                        | **new**  | `otherCategory`  |

New filters extend `buildTransferFilters()` with corresponding Payload `Where` clauses.

## Component Reuse

- `PageWrapper` — page layout
- `TransfersSection` / `TransferDataTable` — table + filters
- `TransferFilters` — extended with new filter options
- `buildTransferFilters()` — extended for new URL params
- All columns visible (no `excludeColumns`)
- Export toolbar (Print/CSV) included via existing `context` config

## Process

- Separate git branch
- Run `/simplify` after each completed step
- Tests covering filtering logic and stat calculations
- Create PR when done
