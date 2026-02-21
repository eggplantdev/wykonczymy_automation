# Surgical Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the highest-impact code duplication across forms, data tables, and detail pages before adding new features.

**Architecture:** Pure extraction refactoring — no behavior changes, no new dependencies. Extract shared patterns into reusable components and hooks, then update consumers to use them.

**Tech Stack:** Next.js 16, React 19, TanStack Form, Tailwind 4, Shadcn UI, TypeScript 5.9

---

## Task 1: Extract shared form fields — AmountField, DateField, DescriptionField

**Files:**

- Create: `src/components/forms/form-fields/amount-field.tsx`
- Create: `src/components/forms/form-fields/date-field.tsx`
- Create: `src/components/forms/form-fields/description-field.tsx`
- Create: `src/components/forms/form-fields/index.ts`

**Context:** These 3 fields appear verbatim in 3-4 forms each. They use the existing `form.AppField` API. The form object is accessed via TanStack Form's context — each field just renders `<form.AppField name="X">`.

**Important:** These field components must accept the `form` instance as a prop since they're used outside the form component tree. Look at how the existing forms use `form.AppField` — the extracted components need the same pattern.

**Step 1: Create AmountField**

```tsx
// src/components/forms/form-fields/amount-field.tsx
type AmountFieldPropsT = {
  readonly form: { AppField: any }
}

export function AmountField({ form }: AmountFieldPropsT) {
  return (
    <form.AppField name="amount">
      {(field: any) => (
        <field.Input label="Kwota (PLN)" placeholder="0.00" type="number" showError />
      )}
    </form.AppField>
  )
}
```

Pattern is identical for DateField (label="Data", type="date") and DescriptionField (label="Opis (opcjonalnie)", placeholder varies).

For DescriptionField, accept an optional `placeholder` prop since transfer form uses "Opis transferu" while deposit uses "Opis wpłaty":

```tsx
type DescriptionFieldPropsT = {
  readonly form: { AppField: any }
  readonly placeholder?: string
}
```

**Step 2: Create the barrel export**

```tsx
// src/components/forms/form-fields/index.ts
export { AmountField } from './amount-field'
export { DateField } from './date-field'
export { DescriptionField } from './description-field'
```

**Step 3: Replace in deposit-form.tsx**

Replace lines 111-119 (amount, date, description fields) with the extracted components. Import from `@/components/forms/form-fields`. Pass `form={form}`.

**Step 4: Replace in register-transfer-form.tsx**

Replace lines 109-133 (amount, date, description fields).

**Step 5: Replace in transfer-form.tsx**

Replace lines 209-221 (description, amount, date fields).

**Step 6: Verify**

Run: `pnpm typecheck`
Expected: No errors

Run: `pnpm lint`
Expected: No errors

**Step 7: Commit**

```bash
git add src/components/forms/form-fields/ src/components/forms/transfer-form/transfer-form.tsx src/components/forms/deposit-form/deposit-form.tsx src/components/forms/register-transfer-form/register-transfer-form.tsx
git commit -m "refactor: extract AmountField, DateField, DescriptionField shared form components"
```

---

## Task 2: Extract PaymentMethodField and CashRegisterField

**Files:**

- Create: `src/components/forms/form-fields/payment-method-field.tsx`
- Create: `src/components/forms/form-fields/cash-register-field.tsx`
- Modify: `src/components/forms/form-fields/index.ts`
- Modify: `src/components/forms/transfer-form/transfer-form.tsx`
- Modify: `src/components/forms/deposit-form/deposit-form.tsx`
- Modify: `src/components/forms/register-transfer-form/register-transfer-form.tsx`

**Context:** PaymentMethodField is identical in all 4 forms. CashRegisterField includes the `ownedRegisterSet` filtering logic that's duplicated 3x.

**Step 1: Create PaymentMethodField**

```tsx
// src/components/forms/form-fields/payment-method-field.tsx
import { SelectItem } from '@/components/ui/select'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants/transfers'

type PaymentMethodFieldPropsT = {
  readonly form: { AppField: any }
}

export function PaymentMethodField({ form }: PaymentMethodFieldPropsT) {
  return (
    <form.AppField name="paymentMethod">
      {(field: any) => (
        <field.Select label="Metoda płatności" showError>
          {PAYMENT_METHODS.map((m) => (
            <SelectItem key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </SelectItem>
          ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
```

**Step 2: Create CashRegisterField**

This is the big one — encapsulates the `ownedRegisterSet` filtering. Accept `cashRegisters` and optional `userCashRegisterIds` as props. Also accept `label` since register-transfer-form uses "Kasa źródłowa" while others use "Kasa".

```tsx
// src/components/forms/form-fields/cash-register-field.tsx
import { useMemo } from 'react'
import { SelectItem } from '@/components/ui/select'
import type { ReferenceItemT } from '@/types/reference-data'

type CashRegisterFieldPropsT = {
  readonly form: { AppField: any }
  readonly name?: string
  readonly label?: string
  readonly placeholder?: string
  readonly cashRegisters: readonly ReferenceItemT[]
  readonly userCashRegisterIds?: number[]
}

export function CashRegisterField({
  form,
  name = 'cashRegister',
  label = 'Kasa',
  placeholder = 'Wybierz kasę',
  cashRegisters,
  userCashRegisterIds,
}: CashRegisterFieldPropsT) {
  const ownedRegisterSet = useMemo(
    () => (userCashRegisterIds ? new Set(userCashRegisterIds) : undefined),
    [userCashRegisterIds],
  )

  return (
    <form.AppField name={name}>
      {(field: any) => (
        <field.Select label={label} placeholder={placeholder} showError>
          {cashRegisters
            .filter((cr) => !ownedRegisterSet || ownedRegisterSet.has(cr.id))
            .map((cr) => (
              <SelectItem key={cr.id} value={String(cr.id)}>
                {cr.name}
              </SelectItem>
            ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
```

**Step 3: Update barrel export**

Add both to `src/components/forms/form-fields/index.ts`.

**Step 4: Replace in all 3 forms**

- `deposit-form.tsx`: Remove `ownedRegisterSet` useMemo (lines 42-44), replace cash register select (lines 131-139) and payment method (lines 122-129)
- `register-transfer-form.tsx`: Remove `ownedRegisterSet` useMemo (lines 41-43), replace source register (lines 89-97) with `<CashRegisterField label="Kasa źródłowa" .../>`, target register (lines 99-106) with `<CashRegisterField name="targetRegister" label="Kasa docelowa" cashRegisters={referenceData.cashRegisters} />` (no userCashRegisterIds filtering), payment method (lines 120-127)
- `transfer-form.tsx`: Remove `ownedRegisterSet` useMemo (lines 63-65), replace cash register (lines 233-243) and payment method (lines 223-231). Keep the `needsCashRegister()` conditional wrapping.

**Step 5: Verify**

Run: `pnpm typecheck && pnpm lint`

**Step 6: Commit**

```bash
git add src/components/forms/form-fields/ src/components/forms/transfer-form/transfer-form.tsx src/components/forms/deposit-form/deposit-form.tsx src/components/forms/register-transfer-form/register-transfer-form.tsx
git commit -m "refactor: extract PaymentMethodField and CashRegisterField with ownedRegister filtering"
```

---

## Task 3: Extract InvestmentField and WorkerField

**Files:**

- Create: `src/components/forms/form-fields/investment-field.tsx`
- Create: `src/components/forms/form-fields/worker-field.tsx`
- Modify: `src/components/forms/form-fields/index.ts`
- Modify: `src/components/forms/transfer-form/transfer-form.tsx`
- Modify: `src/components/forms/deposit-form/deposit-form.tsx`
- Modify: `src/components/forms/settlement-form/settlement-form.tsx`

**Step 1: Create InvestmentField**

```tsx
// src/components/forms/form-fields/investment-field.tsx
import { SelectItem } from '@/components/ui/select'
import type { ReferenceItemT } from '@/types/reference-data'

type InvestmentFieldPropsT = {
  readonly form: { AppField: any }
  readonly investments: readonly ReferenceItemT[]
}

export function InvestmentField({ form, investments }: InvestmentFieldPropsT) {
  return (
    <form.AppField name="investment">
      {(field: any) => (
        <field.Select label="Inwestycja" placeholder="Wybierz inwestycję" showError>
          {investments.map((inv) => (
            <SelectItem key={inv.id} value={String(inv.id)}>
              {inv.name}
            </SelectItem>
          ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
```

**Step 2: Create WorkerField**

Encapsulates the admin/owner filter logic (duplicated in transfer-form and settlement dialog).

```tsx
// src/components/forms/form-fields/worker-field.tsx
import { SelectItem } from '@/components/ui/select'
import type { ReferenceItemT } from '@/types/reference-data'

type WorkerFieldPropsT = {
  readonly form: { AppField: any }
  readonly workers: readonly ReferenceItemT[]
  readonly listeners?: Record<string, any>
}

export function WorkerField({ form, workers, listeners }: WorkerFieldPropsT) {
  return (
    <form.AppField name="worker" listeners={listeners}>
      {(field: any) => (
        <field.Select label="Pracownik" placeholder="Wybierz pracownika" showError>
          {workers
            .filter((w) => w.type !== 'ADMIN' && w.type !== 'OWNER')
            .map((w) => (
              <SelectItem key={w.id} value={String(w.id)}>
                {w.name}
              </SelectItem>
            ))}
        </field.Select>
      )}
    </form.AppField>
  )
}
```

**Step 3: Update barrel export and replace in forms**

- `transfer-form.tsx`: Replace investment select (lines 257-265) and worker select (lines 268-277). Keep the conditional wrappers (`showsInvestment()`, `needsWorker()`).
- `deposit-form.tsx`: Replace investment select (lines 142-149). Keep `requiresInvestment()` conditional.
- `settlement-form.tsx`: Replace investment select (lines 185-192) and worker select (lines 143-156). Settlement worker has a custom `listeners` prop for saldo fetching — pass it via the `listeners` prop.

**Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`

**Step 5: Commit**

```bash
git add src/components/forms/form-fields/ src/components/forms/transfer-form/transfer-form.tsx src/components/forms/deposit-form/deposit-form.tsx src/components/forms/settlement-form/settlement-form.tsx
git commit -m "refactor: extract InvestmentField and WorkerField shared form components"
```

---

## Task 4: Create useActiveFilter hook and consolidate data table wrappers

**Files:**

- Create: `src/hooks/use-active-filter.ts`
- Modify: `src/components/investments/investment-data-table.tsx`
- Modify: `src/components/dashboard/dashboard-tables.tsx`

**Context:** 3 components (`InvestmentDataTable`, `CashRegistersTable`, `UsersTable`) all repeat: `useState(true)` + `useMemo(filter)` + `ActiveFilterButton` in toolbar. Extract to a hook.

**Step 1: Create the hook**

```tsx
// src/hooks/use-active-filter.ts
import { useMemo, useState } from 'react'

export function useActiveFilter<TItem>(
  data: readonly TItem[],
  predicate: (item: TItem) => boolean,
) {
  const [showOnlyActive, setShowOnlyActive] = useState(true)

  const filteredData = useMemo(
    () => (showOnlyActive ? data.filter(predicate) : data),
    [data, showOnlyActive, predicate],
  )

  return { filteredData, showOnlyActive, setShowOnlyActive } as const
}
```

**Important:** The `predicate` must be stable (wrapped in `useCallback` by the consumer or defined outside the component) to avoid infinite re-renders from the useMemo dependency. For these simple cases, define predicates as module-level constants:

```tsx
// In investment-data-table.tsx
const isActiveInvestment = (row: InvestmentRowT) => row.status === 'active'
```

**Step 2: Refactor InvestmentDataTable**

```tsx
// src/components/investments/investment-data-table.tsx
'use client'

import { DataTable } from '@/components/ui/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { investmentColumns, type InvestmentRowT } from '@/lib/tables/investments'
import { useActiveFilter } from '@/hooks/use-active-filter'

const isActive = (row: InvestmentRowT) => row.status === 'active'

type InvestmentDataTablePropsT = {
  readonly data: readonly InvestmentRowT[]
}

export function InvestmentDataTable({ data }: InvestmentDataTablePropsT) {
  const { filteredData, showOnlyActive, setShowOnlyActive } = useActiveFilter(data, isActive)

  return (
    <DataTable
      data={filteredData}
      columns={investmentColumns}
      emptyMessage="Brak inwestycji"
      storageKey="investments"
      getRowHref={(row) => `/inwestycje/${row.id}`}
      getRowClassName={(row) => (row.status === 'completed' ? 'opacity-50' : '')}
      toolbar={(table) => (
        <>
          <ActiveFilterButton
            isActive={showOnlyActive}
            onChange={setShowOnlyActive}
            activeLabel="Aktywne"
            allLabel="Wszystkie"
          />
          <ColumnToggle table={table} />
        </>
      )}
    />
  )
}
```

**Step 3: Refactor CashRegistersTable and UsersTable in dashboard-tables.tsx**

Same pattern: extract predicate to module level, use `useActiveFilter`.

```tsx
const isCashRegisterActive = (row: CashRegisterRowT) => row.active
const isUserActive = (row: UserRowT) => row.active
```

**Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`

**Step 5: Commit**

```bash
git add src/hooks/use-active-filter.ts src/components/investments/investment-data-table.tsx src/components/dashboard/dashboard-tables.tsx
git commit -m "refactor: extract useActiveFilter hook, consolidate data table wrapper patterns"
```

---

## Task 5: Extract FilterConfigT type and remove dead code

**Files:**

- Create: `src/types/filters.ts`
- Modify: `src/components/transfers/transfer-data-table.tsx` (remove local FilterConfigT)
- Modify: `src/components/transfers/transfer-table-server.tsx` (remove local FilterConfigT)
- Modify: `src/components/ui/tag.tsx` (remove `tagVariants` export)
- Modify: `src/components/ui/pagination/pagination.tsx` (remove `SimplePagination`, `getVisiblePages` exports)
- Delete: `src/components/ui/pagination/get-visible-pages.ts`

**Step 1: Create FilterConfigT shared type**

```tsx
// src/types/filters.ts
export type FilterConfigT = {
  readonly cashRegisters?: { id: number; name: string }[]
  readonly investments?: { id: number; name: string }[]
  readonly users?: { id: number; name: string }[]
  readonly showTypeFilter?: boolean
}
```

**Step 2: Update transfer-data-table.tsx and transfer-table-server.tsx**

Remove local `FilterConfigT` type definitions. Import from `@/types/filters`.

**Step 3: Remove dead exports**

- `tag.tsx`: Remove line 106 (`export { tagVariants }`). Keep the const for internal use.
- `pagination.tsx`: Remove `SimplePagination` component (lines 129-179), remove `getVisiblePages` re-export (line 190), remove `SimplePagination` from export block (line 191). Remove `getVisiblePages` import from line 5.
- Delete `get-visible-pages.ts` entirely (also has stale console.logs — lines 10-12, 15, 24-25, 31, 35, 39).

**Step 4: Verify no broken imports**

Run: `pnpm typecheck && pnpm lint`

If `SimplePagination` or `getVisiblePages` are imported anywhere, typecheck will catch it. Based on the audit, they're not used.

**Step 5: Commit**

```bash
git add src/types/filters.ts src/components/transfers/transfer-data-table.tsx src/components/transfers/transfer-table-server.tsx src/components/ui/tag.tsx src/components/ui/pagination/pagination.tsx
git rm src/components/ui/pagination/get-visible-pages.ts
git commit -m "refactor: extract FilterConfigT to shared type, remove dead pagination and tag exports"
```

---

## Task 6: Extract TransfersSection component

**Files:**

- Create: `src/components/transfers/transfers-section.tsx`
- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx`
- Modify: `src/app/(frontend)/kasa/[id]/page.tsx`
- Modify: `src/components/user-transfer-view.tsx`
- Modify: `src/components/dashboard/manager-dashboard.tsx`

**Context:** The pattern `<CollapsibleSection title="Transfery"> <Suspense fallback={<TransferTableSkeleton />}> <TransferTableServer ...props className="mt-4" /> </Suspense> </CollapsibleSection>` appears 4 times. Extract it.

**Step 1: Create TransfersSection**

```tsx
// src/components/transfers/transfers-section.tsx
import { Suspense } from 'react'
import type { Where } from 'payload'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'
import type { FilterConfigT } from '@/types/filters'

type TransfersSectionPropsT = {
  readonly title?: string
  readonly where: Where
  readonly page: number
  readonly limit: number
  readonly baseUrl: string
  readonly excludeColumns?: string[]
  readonly filters?: FilterConfigT
  readonly className?: string
}

export function TransfersSection({
  title = 'Transfery',
  where,
  page,
  limit,
  baseUrl,
  excludeColumns,
  filters,
  className,
}: TransfersSectionPropsT) {
  return (
    <CollapsibleSection title={title} className={className}>
      <Suspense fallback={<TransferTableSkeleton />}>
        <TransferTableServer
          where={where}
          page={page}
          limit={limit}
          excludeColumns={excludeColumns}
          baseUrl={baseUrl}
          filters={filters}
          className="mt-4"
        />
      </Suspense>
    </CollapsibleSection>
  )
}
```

**Step 2: Replace in investment detail page**

Replace lines 64-76 in `inwestycje/[id]/page.tsx` with:

```tsx
<TransfersSection
  where={transferWhere}
  page={page}
  limit={limit}
  excludeColumns={['investment']}
  baseUrl={`/inwestycje/${id}`}
  filters={{}}
/>
```

Remove imports for `Suspense`, `CollapsibleSection`, `TransferTableSkeleton`.

**Step 3: Replace in cash register detail page**

Replace lines 45-57 in `kasa/[id]/page.tsx`.

**Step 4: Replace in user-transfer-view.tsx**

Replace lines 78-90.

**Step 5: Replace in manager-dashboard.tsx**

Replace lines 56-71. Note: manager dashboard uses `title="Ostatnie transfery"` and `className="mt-8"`, so pass those props.

**Step 6: Verify**

Run: `pnpm typecheck && pnpm lint`

**Step 7: Commit**

```bash
git add src/components/transfers/transfers-section.tsx src/app/\(frontend\)/inwestycje/\[id\]/page.tsx src/app/\(frontend\)/kasa/\[id\]/page.tsx src/components/user-transfer-view.tsx src/components/dashboard/manager-dashboard.tsx
git commit -m "refactor: extract TransfersSection component, used across 4 pages"
```

---

## Task 7: Extract EmptyState component

**Files:**

- Create: `src/components/ui/empty-state.tsx`
- Modify: `src/app/(frontend)/error.tsx`
- Modify: `src/app/(frontend)/not-found.tsx`

**Context:** Both files share `flex flex-1 flex-col items-center justify-center gap-4 p-8` wrapper and `text-foreground text-lg font-semibold` heading.

**Step 1: Create EmptyState**

```tsx
// src/components/ui/empty-state.tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type EmptyStatePropsT = {
  readonly title: string
  readonly description?: string
  readonly children?: ReactNode
  readonly className?: string
}

export function EmptyState({ title, description, children, className }: EmptyStatePropsT) {
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-4 p-8', className)}>
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
      {children}
    </div>
  )
}
```

**Step 2: Refactor error.tsx**

```tsx
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <EmptyState title="Coś poszło nie tak">
      <Button variant="outline" onClick={() => reset()}>
        Spróbuj ponownie
      </Button>
    </EmptyState>
  )
}
```

**Step 3: Refactor not-found.tsx**

```tsx
import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'

export default function NotFound() {
  return (
    <EmptyState title="Nie znaleziono" description="Nie udało się znaleźć żądanego zasobu">
      <Link href="/" className="text-primary text-sm underline underline-offset-4 hover:opacity-80">
        Wróć na stronę główną
      </Link>
    </EmptyState>
  )
}
```

**Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`

**Step 5: Commit**

```bash
git add src/components/ui/empty-state.tsx src/app/\(frontend\)/error.tsx src/app/\(frontend\)/not-found.tsx
git commit -m "refactor: extract EmptyState component for error and not-found pages"
```

---

## Task 8: Lib layer quick fixes

**Files:**

- Modify: `src/lib/tables/transfers.tsx` (remove duplicate `getRelationName`)
- Modify: `src/components/ui/page-wrapper.tsx` (fix template literal bug)
- Modify: `src/components/ui/active-filter-button.tsx` (use design tokens)
- Modify: `src/components/ui/label.tsx` (remove `'use client'`)
- Modify: `src/components/ui/separator.tsx` (remove `'use client'`)

**Step 1: Fix getRelationName duplicate**

In `src/lib/tables/transfers.tsx`, remove the private `getRelationName` function (lines 130-135). Add import at top:

```tsx
import { getRelationName } from '@/lib/get-relation-name'
```

The library version has an optional `fallback` param that defaults to `'—'` — same as the private version. Drop-in replacement.

**Step 2: Fix PageWrapper template literal bug**

Line 30 of `src/components/ui/page-wrapper.tsx`:

```tsx
// BUG: missing space before mt-2
<h1 className={`text-foreground text-2xl font-semibold${backHref ? 'mt-2' : ''}`}>

// FIX:
<h1 className={`text-foreground text-2xl font-semibold${backHref ? ' mt-2' : ''}`}>
```

**Step 3: Fix ActiveFilterButton hardcoded colors**

In `src/components/ui/active-filter-button.tsx`, replace line 23:

```tsx
// Before:
isActive ? 'border-green-600 text-green-600 hover:bg-green-600 hover:text-white' : undefined

// After:
isActive ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground' : undefined
```

**Step 4: Remove unnecessary 'use client' directives**

- `src/components/ui/label.tsx`: Remove line 1 (`'use client'`). The Radix Label primitive works as a server component — it's purely presentational (no hooks or event handlers).
- `src/components/ui/separator.tsx`: Same — remove line 1. Radix Separator is purely presentational.

**Important caveat:** Before removing `'use client'`, verify these components aren't imported by other client components that expect them to be client components. In Next.js, if a server component is imported into a client component, it gets wrapped automatically, so removing the directive is safe. Verify with typecheck.

**Step 5: Verify**

Run: `pnpm typecheck && pnpm lint`

**Step 6: Commit**

```bash
git add src/lib/tables/transfers.tsx src/components/ui/page-wrapper.tsx src/components/ui/active-filter-button.tsx src/components/ui/label.tsx src/components/ui/separator.tsx
git commit -m "fix: remove getRelationName duplicate, fix PageWrapper class bug, use design tokens in ActiveFilterButton, remove unnecessary use client directives"
```

---

## Task 9: Final verification

**Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: 0 errors

**Step 2: Full lint**

Run: `pnpm lint`
Expected: 0 errors or only pre-existing warnings

**Step 3: Dev server smoke test**

Run: `pnpm dev`

Verify manually:

- Dashboard loads (stat cards, tables, transfer list)
- Investment detail page loads (info list, stat cards, transfers section)
- Cash register detail page loads (info, balance, transfers)
- User detail page loads (info, saldo, transfers)
- Add transfer dialog opens and form fields render correctly
- Add deposit dialog opens and form fields render
- Add register transfer dialog opens and form fields render
- Settlement form loads and renders line items
- Error page renders (navigate to non-existent route to check not-found)

**Step 4: Run tests**

Run: `pnpm test`
Expected: All existing tests pass

**Step 5: Final commit if any adjustments needed**

If smoke testing reveals issues, fix and commit each fix separately.
