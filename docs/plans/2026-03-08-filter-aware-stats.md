# Filter-Aware Stat Cards & Full Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all entity detail pages (investment, cash register, worker) use filter-aware stat cards and full filter UI, matching the reports page pattern.

**Architecture:** Replace static cached queries (`fetchInvestmentFinancials`, `fetchRegisterBalances`, `fetchWorkerSaldos`) with `fetchFilteredByType(where)` → derive functions on each entity page. The same `where` clause drives both stat cards and the transaction table. Each page hides its own implicit entity filter from the filter UI.

**Tech Stack:** Next.js server components, raw SQL via `sumFilteredByType`, existing derive functions, URL search params for filter state.

---

### ✅ Task 1: Investment Page — Filter-Aware Stat Cards (DONE)

Commit: `89929f5` — merged to main.

- Replaced `fetchInvestmentFinancials` with `fetchFilteredByType(transferWhere)` + `deriveFinancials`
- `urlFilters` + entity filter moved before fetch so stat cards and table share the same `where`
- Filters use `buildFilterConfig(refData, 'investments')` — excludes investment filter (implicit)

---

### ✅ Task 2: Cash Register Page — Filter-Aware Stat Cards + Full Filters (DONE)

Commit: `89929f5` — merged to main.

- Replaced `fetchRegisterBalances` / `StatCard` with `fetchFilteredByType` + `deriveFinancials` / `InvestmentStats`
- New headerFields: Koszty, Wpływy, Koszty robocizny, Bilans (was just Saldo)
- Filters use `buildFilterConfig(refData, 'cashRegisters')` — excludes register filter (implicit)

---

### ✅ Task 3: Worker Page — Filter-Aware Stat Cards + Full Filters (DONE)

Commit: `89929f5` — merged to main.

- Replaced `fetchWorkerSaldos` + `fetchWorkerPeriodBreakdown` / `StatCard` with `fetchFilteredByType` + `deriveWorkerBreakdown` / `InvestmentStats`
- Removed `showTypeFilter` prop and updated caller in `page.tsx`
- Filters use `buildFilterConfig(refData, 'workers')` — excludes worker filter (implicit)

---

### ✅ Bonus: Extracted `buildFilterConfig` helper (DONE)

Created `src/lib/build-filter-config.ts` — builds full `FilterConfigT` from `refData`, optionally excluding one entity. Also updated `raporty/page.tsx` to use `buildFilterConfig(refData)` (no exclusion).

---

### Task 4: Verify stat cards react to filters

**⚠️ Known concern:** `fetchFilteredByType` in `src/lib/queries/reference-data.ts` has `'use cache'` + `cacheLife('max')`. This caches results keyed by `where` arguments. In theory Next.js serializes args for cache keys, but needs verification.

**Step 1: Test in dev**

Run: `pnpm dev`

Test each page — apply a date range filter and verify stat cards update:

- `/inwestycje/[id]` — apply date range → stat cards should show filtered totals (not all-time)
- `/kasa/[id]` — apply date range → stat cards should update
- `/uzytkownicy/[id]` — apply date range → stat cards should update
- `/raporty` — verify no regression

**Step 2: If stat cards DON'T update with filters**

Remove `'use cache'` from `fetchFilteredByType`:

```typescript
// In src/lib/queries/reference-data.ts
// Before:
export async function fetchFilteredByType(where: Where): Promise<TypeTotalT[]> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.transfers)

  const payload = await getPayload({ config })
  return sumFilteredByType(payload, where)
}

// After:
export async function fetchFilteredByType(where: Where): Promise<TypeTotalT[]> {
  const payload = await getPayload({ config })
  return sumFilteredByType(payload, where)
}
```

Rationale: this is a lightweight SQL `GROUP BY` query. The static batch queries and `fetchReferenceData` remain cached — removing cache here only affects per-page filter queries.

**Step 3: Run tests**

Run: `pnpm test`

**Step 4: Commit if changes were needed**

```bash
git add src/lib/queries/reference-data.ts
git commit -m "fix: remove cache from fetchFilteredByType so filters affect stat cards"
```

---

### Task 5: Cleanup — Remove Unused Code

**Files:**

- Modify: `src/lib/queries/reference-data.ts` (check if `fetchInvestmentFinancials`, `fetchRegisterBalances`, `fetchWorkerSaldos` are still used elsewhere — dashboard likely still uses them)
- Modify: `src/lib/queries/users.ts` (check if `fetchWorkerPeriodBreakdown` is still used)

**Step 1: Check for remaining usages**

Run: `grep -r "fetchInvestmentFinancials\|fetchRegisterBalances\|fetchWorkerSaldos\|fetchWorkerPeriodBreakdown" src/ --include="*.ts" --include="*.tsx"`

If dashboard still uses `fetchInvestmentFinancials`, `fetchRegisterBalances`, `fetchWorkerSaldos` — leave them. Only remove `fetchWorkerPeriodBreakdown` if unused.

**Step 2: Remove dead code if found**

Delete unused functions and their imports.

**Step 3: Run typecheck + tests**

Run: `pnpm typecheck && pnpm test`

**Step 4: Commit**

```bash
git add -u
git commit -m "refactor: remove unused query functions after filter-aware stats migration"
```
