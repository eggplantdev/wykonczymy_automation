# Design: Filter-Aware Stat Cards & Full Filters on Entity Pages

## Problem

Entity detail pages (investment, cash register, worker) have static stat cards that don't respond to table filters. The reports page already solves this with `fetchFilteredByType()` → derive functions. The entity pages should behave the same way.

Additionally, cash register and worker pages are missing most filter options — only investment has filters beyond the implicit entity scope.

## Scope

All three entity pages get:

1. **Full filter UI** — all filters from `TransferFilters` component, minus the implicit entity filter
2. **Filter-aware stat cards** — stat card values recalculate based on active URL filters

## Pages & Changes

### Investment (`/inwestycje/[id]`)

- **Current:** Static stat cards from `fetchInvestmentFinancials()`, most filters available
- **After:** Replace with `fetchFilteredByType(where)` → `deriveFinancials()` where `where` = URL filters + `investment: { equals: id }`
- **Filters:** All except investment selector (implicit)
- **Stat cards:** Costs, income, labor costs, balance (same as today, now filter-aware)

### Cash Register (`/kasa/[id]`)

- **Current:** Static balance from `fetchRegisterBalances()`, no filters (`filters: {}`)
- **After:** `fetchFilteredByType(where)` → derive function where `where` = URL filters + `sourceRegister: { equals: id }`
- **Filters:** All except cash register selector (implicit)
- **Stat cards:** Costs, income, balance (filter-aware)

### Worker (`/uzytkownicy/[id]`)

- **Current:** Static saldo from `fetchWorkerSaldos()`, conditional period breakdown on date filter, type filter only
- **After:** `fetchFilteredByType(where)` → `deriveWorkerBreakdown()` where `where` = URL filters + `worker: { equals: id }`
- **Filters:** All except worker selector (implicit)
- **Stat cards:** Advances, expenses, period saldo (always shown, filter-aware)

## Data Flow (same for all pages)

```
URL searchParams
      ↓
buildTransferFilters(sp, userContext)
      ↓
Where { ...urlFilters, [entity]: { equals: id } }
      ↓
┌─────────────────────────────┐    ┌──────────────────────────────┐
│ fetchFilteredByType(where)  │    │ findTransfersRaw(where, ...) │
│ → derive function           │    │ → transaction table rows     │
│ → stat cards                │    │ → TransferDataTable          │
└─────────────────────────────┘    └──────────────────────────────┘
```

Same `where` drives both stat cards and table — filters always apply to everything.

## Filter Config Per Page

| Filter         | Investment    | Cash Register | Worker        | Reports |
| -------------- | ------------- | ------------- | ------------- | ------- |
| Type           | ✅            | ✅            | ✅            | ✅      |
| Cash Register  | ✅            | ❌ (implicit) | ✅            | ✅      |
| Investment     | ❌ (implicit) | ✅            | ✅            | ✅      |
| Created By     | ✅            | ✅            | ✅            | ✅      |
| Worker         | ✅            | ✅            | ❌ (implicit) | ✅      |
| Payment Method | ✅            | ✅            | ✅            | ✅      |
| Other Category | ✅            | ✅            | ✅            | ✅      |
| Date Range     | ✅            | ✅            | ✅            | ✅      |

## Derive Functions

- **Investment:** `deriveFinancials()` (existing)
- **Cash Register:** `deriveFinancials()` (reuse — costs/income/balance applies)
- **Worker:** `deriveWorkerBreakdown()` (existing — advances/expenses/saldo)

## No New Components

- `TransferFilters` already renders conditionally based on `filters` config
- `InvestmentStats` / stat card components already exist
- Derive functions already exist
- `fetchFilteredByType()` already exists

## Tradeoffs

**Pro:** Consistent UX across all entity pages and reports. Single data flow pattern.

**Con:** Static cached queries (`fetchInvestmentFinancials`, `fetchRegisterBalances`, `fetchWorkerSaldos`) become unused on detail pages (still used on dashboard). Slight overhead from `fetchFilteredByType` running per-request instead of cached batch queries — negligible at current scale.
