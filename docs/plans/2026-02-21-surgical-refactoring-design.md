# Surgical Refactoring Design

**Date:** 2026-02-21
**Status:** Approved
**Scope:** Eliminate highest-impact code duplication before adding new features

---

## Context

Full codebase audit identified 4 critical duplication areas. This design addresses the top issues via surgical, incremental refactoring — no architectural rewrites.

## Deferred (Out of Scope)

- Query factory abstraction (`createCachedQuery()`)
- Cache tag strategy overhaul
- Validation triplication fix (client schema + server schema + Payload hook)
- TransferFilters split into subcomponents
- Perf logging standardization

---

## Phase 1: Form Field Extraction

### Problem

4 forms (transfer, deposit, register-transfer, settlement) repeat identical field rendering 3-4x each. Cash register filtering (`ownedRegisterSet` useMemo) is copied in 3 files. Payment method, amount, date, description, investment, and worker selects are verbatim copies.

### Solution

Create pre-built field components in `src/components/forms/form-fields/`:

| Component            | Encapsulates                           | Used by |
| -------------------- | -------------------------------------- | ------- |
| `AmountField`        | Label, placeholder, number type        | 4 forms |
| `DateField`          | Label, date type                       | 4 forms |
| `DescriptionField`   | Label, placeholder, optional indicator | 3 forms |
| `PaymentMethodField` | PAYMENT_METHODS map + labels           | 4 forms |
| `CashRegisterField`  | ownedRegisterSet filtering + select    | 3 forms |
| `InvestmentField`    | Conditional visibility + select        | 3 forms |
| `WorkerField`        | Admin/owner filter + select            | 2 forms |

Each field uses the existing `form.AppField` pattern internally. Forms pass reference data and field-specific config as props.

### Files

- **New:** 7 field components + `index.ts` barrel in `src/components/forms/form-fields/`
- **Modified:** `transfer-form.tsx`, `deposit-form.tsx`, `register-transfer-form.tsx`, `settlement-form.tsx`

---

## Phase 2: Data Table Wrapper Consolidation

### Problem

4 table wrappers (`InvestmentDataTable`, `CashRegistersTable`, `UsersTable`, `TransferDataTable`) repeat identical active-filter + useMemo + toolbar pattern. `FilterConfigT` type defined in 2 files. Dead exports: `SimplePagination`, `getVisiblePages`, `tagVariants`, `get-visible-pages.ts`.

### Solution

1. Create `useActiveFilter<T>(data: T[], predicate: (item: T) => boolean)` hook returning `{ filteredData, isActive, toggle }`
2. Each wrapper uses hook instead of manual useState + useMemo
3. Extract `FilterConfigT` to `src/types/filters.ts`
4. Remove dead exports and unused file

### Files

- **New:** `src/hooks/use-active-filter.ts`, `src/types/filters.ts`
- **Modified:** 4 table wrapper files
- **Deleted:** `src/components/ui/pagination/get-visible-pages.ts`
- **Cleaned:** `pagination.tsx` (remove SimplePagination, getVisiblePages exports), `tag.tsx` (remove tagVariants export)

---

## Phase 3: Detail Page Deduplication

### Problem

Investment/cash register detail pages share ~80% structure. `CollapsibleSection + Suspense + TransferTableServer` pattern appears 3x. Error/404 pages share identical Tailwind with no shared component. StatCard grids repeat `grid grid-cols-1 gap-4 sm:grid-cols-X` in 3+ places.

### Solution

1. **`TransfersSection`** — wraps CollapsibleSection + Suspense + TransferTableServer + skeleton. Props: `where`, `page`, `limit`, `excludeColumns`, `baseUrl`
2. **`StatCardGrid`** — standardizes responsive grid. Props: `columns` (breakpoint config), `children`
3. **`EmptyState`** — centering + heading + optional description + optional action. Used by error.tsx and not-found.tsx

### Files

- **New:** 3 components in `src/components/ui/`
- **Modified:** `inwestycje/[id]/page.tsx`, `kasa/[id]/page.tsx`, `user-transfer-view.tsx`, `manager-dashboard.tsx`, `error.tsx`, `not-found.tsx`

---

## Phase 4: Lib Layer Quick Fixes

| Fix                                      | Details                                                                 | Files                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Remove `getRelationName` duplicate       | `transfers.tsx` has private copy; import from `@/lib/get-relation-name` | `src/lib/tables/transfers.tsx`                                      |
| Consolidate `DateRangeT`                 | Single type in `src/types/date.ts` with `from/to` fields                | `src/lib/db/sum-transfers.ts`, `src/types/date.ts` (new), consumers |
| Fix `PageWrapper` template literal       | Missing space before conditional `mt-2` class                           | `src/components/ui/page-wrapper.tsx`                                |
| Remove unnecessary `'use client'`        | `label.tsx`, `separator.tsx` don't need client directive                | 2 files                                                             |
| Fix `ActiveFilterButton` hardcoded green | Replace `green-600` with `border-primary text-primary` tokens           | `src/components/ui/active-filter-button.tsx`                        |
| Standardize `null` to `undefined`        | `getMediaField` return type, query error returns                        | ~4 files                                                            |

---

## Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4

Each phase is independently deployable. Phase 4 has zero dependencies and could run in parallel with any other phase.

## Success Criteria

- All existing functionality preserved (no behavior changes)
- `pnpm typecheck` passes
- `pnpm lint` passes
- Forms render and submit correctly
- Tables filter and paginate correctly
- Detail pages load with correct data
