# Investment CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add and edit investments from the frontend via dialog-based forms, following the existing transfer edit pattern.

**Architecture:** Separate add/edit form components with inline field rendering (no shared field component — matches existing codebase pattern where fields are inline in each form). Both use `FormDialog` + `useFormSubmit` for optimistic close. Server actions use `protectedAction` wrapper with Zod validation and cache revalidation.

**Tech Stack:** TanStack React Form, Zod 4, Shadcn Dialog, Zustand (optimistic form store), Payload CMS

**Spec:** `docs/superpowers/specs/2026-03-25-investment-crud-design.md`

---

## File Map

### New Files

| File                                                            | Responsibility                                     |
| --------------------------------------------------------------- | -------------------------------------------------- |
| `src/lib/schemas/investment.ts`                                 | Server-side Zod schema + types                     |
| `src/lib/actions/investments.ts`                                | `createInvestmentAction`, `updateInvestmentAction` |
| `src/components/forms/investment-form/investment-schema.ts`     | Client-side Zod schema                             |
| `src/components/forms/investment-form/add-investment-form.tsx`  | Add form with empty defaults, inline fields        |
| `src/components/forms/investment-form/edit-investment-form.tsx` | Edit form with row defaults, inline fields         |
| `src/components/dialogs/add-investment-dialog.tsx`              | FormDialog + trigger button                        |
| `src/components/dialogs/edit-investment-dialog.tsx`             | FormDialog + edit icon trigger                     |

### Modified Files

| File                                                   | Change                                              |
| ------------------------------------------------------ | --------------------------------------------------- |
| `src/lib/tables/investments.tsx`                       | Add `notes` to `InvestmentRowT`, add actions column |
| `src/lib/queries/dashboard.ts`                         | Pass `notes` to row                                 |
| `src/components/investments/investment-data-table.tsx` | Add toolbar button                                  |
| `src/app/(frontend)/inwestycje/[id]/page.tsx`          | Add edit button as first child of PageWrapper       |

---

## Task 1: Server Schema

**Files:**

- Create: `src/lib/schemas/investment.ts`

- [ ] **Step 1: Create the server schema**

```typescript
// src/lib/schemas/investment.ts
import { z } from 'zod'

export const investmentSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z
    .union([z.literal(''), z.string().email('Nieprawidłowy adres email')])
    .optional()
    .default(''),
  contactPerson: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  review: z.string().optional().default(''),
  status: z.enum(['active', 'completed']),
})

export type InvestmentFormDataT = z.infer<typeof investmentSchema>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/schemas/investment.ts
git commit -m "feat(investments): add server-side Zod schema"
```

---

## Task 2: Server Actions

**Files:**

- Create: `src/lib/actions/investments.ts`
- Reference: `src/lib/actions/transfers.ts` (pattern), `src/lib/actions/utils.ts` (protectedAction, validateAction)

- [ ] **Step 1: Create server actions file**

```typescript
// src/lib/actions/investments.ts
'use server'

import { perfStart } from '@/lib/perf'
import { investmentSchema, type InvestmentFormDataT } from '@/lib/schemas/investment'
import { validateAction, protectedAction } from './utils'

export async function createInvestmentAction(data: InvestmentFormDataT) {
  return protectedAction(
    'createInvestmentAction',
    async ({ payload }) => {
      const step = perfStart()

      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      await payload.create({
        collection: 'investments',
        data: parsed.data,
      })
      console.log(`[PERF]   payload.create ${step()}ms`)

      return { success: true }
    },
    ['investments'],
  )
}

export async function updateInvestmentAction(id: number, data: InvestmentFormDataT) {
  return protectedAction(
    'updateInvestmentAction',
    async ({ payload }) => {
      const step = perfStart()

      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed
      console.log(`[PERF]   validateAction ${step()}ms`)

      await payload.update({
        collection: 'investments',
        id,
        data: parsed.data,
      })
      console.log(`[PERF]   payload.update ${step()}ms`)

      return { success: true }
    },
    ['investments'],
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/investments.ts
git commit -m "feat(investments): add create and update server actions"
```

---

## Task 3: Client Schema

**Files:**

- Create: `src/components/forms/investment-form/investment-schema.ts`
- Reference: `src/components/forms/expense-form/expense-schema.ts` (pattern)

- [ ] **Step 1: Create client schema**

```typescript
// src/components/forms/investment-form/investment-schema.ts
import { z } from 'zod'

export const investmentFormSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
  contactPerson: z.string(),
  notes: z.string(),
  review: z.string(),
  status: z.enum(['active', 'completed']),
})

export type InvestmentFormValuesT = z.infer<typeof investmentFormSchema>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/forms/investment-form/investment-schema.ts
git commit -m "feat(investments): add client-side form schema"
```

---

## Task 4: Add Investment Form

**Files:**

- Create: `src/components/forms/investment-form/add-investment-form.tsx`
- Reference: `src/components/forms/edit-transfer-form/edit-transfer-form.tsx` (pattern — fields inline, same structure)

- [ ] **Step 1: Create add form**

Fields are rendered inline (not extracted to a shared component) to avoid generic typing issues with `useAppForm`. This matches the existing pattern in `edit-transfer-form.tsx`.

```tsx
// src/components/forms/investment-form/add-investment-form.tsx
'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import useCheckFormErrors from '@/components/forms/hooks/use-check-form-errors'
import FormFooter from '@/components/forms/form-components/form-footer'
import { investmentFormSchema, type InvestmentFormValuesT } from './investment-schema'
import { createInvestmentAction } from '@/lib/actions/investments'
import type { InvestmentFormDataT } from '@/lib/schemas/investment'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type AddInvestmentFormPropsT = {
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

const FORM_ID = 'add-investment'

const EMPTY_DEFAULTS: InvestmentFormValuesT = {
  name: '',
  address: '',
  phone: '',
  email: '',
  contactPerson: '',
  notes: '',
  review: '',
  status: 'active',
}

export function AddInvestmentForm({ onSubmitSuccess, keepOpen }: AddInvestmentFormPropsT) {
  const { recoveredValues, submit } = useFormSubmit<InvestmentFormValuesT>(FORM_ID)

  const form = useAppForm({
    defaultValues: recoveredValues ?? EMPTY_DEFAULTS,
    validators: {
      onSubmit: investmentFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: InvestmentFormDataT = {
        name: value.name,
        address: value.address,
        phone: value.phone,
        email: value.email,
        contactPerson: value.contactPerson,
        notes: value.notes,
        review: value.review,
        status: value.status,
      }

      await submit(!!keepOpen, {
        action: () => createInvestmentAction(data),
        successMessage: 'Inwestycja dodana',
        formValues: value as Record<string, unknown>,
        onSubmitSuccess,
        onKeepOpenSuccess: () => form.reset(),
      })

      return false
    },
  })

  useCheckFormErrors(form)

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.AppField name="name">
            {(field: AppFieldComponentsT) => (
              <field.Input label="Nazwa" placeholder="Nazwa inwestycji" showError />
            )}
          </form.AppField>

          <form.AppField name="address">
            {(field: AppFieldComponentsT) => (
              <field.Input label="Adres" placeholder="Adres inwestycji" showError />
            )}
          </form.AppField>

          <form.AppField name="phone">
            {(field: AppFieldComponentsT) => (
              <field.Input label="Telefon" placeholder="Numer telefonu" showError />
            )}
          </form.AppField>

          <form.AppField name="email">
            {(field: AppFieldComponentsT) => (
              <field.Input label="Email" type="email" placeholder="Adres email" showError />
            )}
          </form.AppField>

          <form.AppField name="contactPerson">
            {(field: AppFieldComponentsT) => (
              <field.Input label="Osoba kontaktowa" placeholder="Imię i nazwisko" showError />
            )}
          </form.AppField>

          <form.AppField name="notes">
            {(field: AppFieldComponentsT) => (
              <field.Textarea label="Notatki" placeholder="Notatki..." rows={3} showError />
            )}
          </form.AppField>

          <form.AppField name="review">
            {(field: AppFieldComponentsT) => (
              <field.Textarea label="Opinia" placeholder="Opinia..." rows={3} showError />
            )}
          </form.AppField>

          <form.AppField name="status">
            {(field: AppFieldComponentsT) => (
              <field.Select label="Status" showError>
                <SelectItem value="active">Aktywna</SelectItem>
                <SelectItem value="completed">Zakończona</SelectItem>
              </field.Select>
            )}
          </form.AppField>
        </FieldGroup>

        <FormFooter label="Dodaj" submittingLabel="Dodawanie..." className="mt-6" />
      </form>
    </form.AppForm>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/forms/investment-form/add-investment-form.tsx
git commit -m "feat(investments): add AddInvestmentForm component"
```

---

## Task 5: Edit Investment Form

**Files:**

- Create: `src/components/forms/investment-form/edit-investment-form.tsx`
- Reference: `src/components/forms/edit-transfer-form/edit-transfer-form.tsx` (pattern)

- [ ] **Step 1: Create edit form**

Uses `InvestmentRefT` from `@/types/reference-data` — both `InvestmentRowT` (table) and `InvestmentRefT` (detail page) satisfy this type since `InvestmentRowT` extends all the same base fields.

```tsx
// src/components/forms/investment-form/edit-investment-form.tsx
'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import useCheckFormErrors from '@/components/forms/hooks/use-check-form-errors'
import FormFooter from '@/components/forms/form-components/form-footer'
import { investmentFormSchema, type InvestmentFormValuesT } from './investment-schema'
import { updateInvestmentAction } from '@/lib/actions/investments'
import type { InvestmentFormDataT } from '@/lib/schemas/investment'
import type { InvestmentRefT } from '@/types/reference-data'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type EditInvestmentFormPropsT = {
  investment: InvestmentRefT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

export function EditInvestmentForm({
  investment,
  onSubmitSuccess,
  keepOpen,
}: EditInvestmentFormPropsT) {
  const formId = `edit-investment-${investment.id}`
  const { recoveredValues, submit } = useFormSubmit<InvestmentFormValuesT>(formId)

  const form = useAppForm({
    defaultValues:
      recoveredValues ??
      ({
        name: investment.name,
        address: investment.address,
        phone: investment.phone,
        email: investment.email,
        contactPerson: investment.contactPerson,
        notes: investment.notes,
        review: investment.review,
        status: investment.status,
      } as InvestmentFormValuesT),
    validators: {
      onSubmit: investmentFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: InvestmentFormDataT = {
        name: value.name,
        address: value.address,
        phone: value.phone,
        email: value.email,
        contactPerson: value.contactPerson,
        notes: value.notes,
        review: value.review,
        status: value.status,
      }

      await submit(!!keepOpen, {
        action: () => updateInvestmentAction(investment.id, data),
        successMessage: 'Inwestycja zaktualizowana',
        formValues: value as Record<string, unknown>,
        onSubmitSuccess,
        onKeepOpenSuccess: () => form.reset(),
      })

      return false
    },
  })

  useCheckFormErrors(form)

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.AppField name="name">
            {(field: AppFieldComponentsT) => (
              <field.Input label="Nazwa" placeholder="Nazwa inwestycji" showError />
            )}
          </form.AppField>

          <form.AppField name="address">
            {(field: AppFieldComponentsT) => (
              <field.Input label="Adres" placeholder="Adres inwestycji" showError />
            )}
          </form.AppField>

          <form.AppField name="phone">
            {(field: AppFieldComponentsT) => (
              <field.Input label="Telefon" placeholder="Numer telefonu" showError />
            )}
          </form.AppField>

          <form.AppField name="email">
            {(field: AppFieldComponentsT) => (
              <field.Input label="Email" type="email" placeholder="Adres email" showError />
            )}
          </form.AppField>

          <form.AppField name="contactPerson">
            {(field: AppFieldComponentsT) => (
              <field.Input label="Osoba kontaktowa" placeholder="Imię i nazwisko" showError />
            )}
          </form.AppField>

          <form.AppField name="notes">
            {(field: AppFieldComponentsT) => (
              <field.Textarea label="Notatki" placeholder="Notatki..." rows={3} showError />
            )}
          </form.AppField>

          <form.AppField name="review">
            {(field: AppFieldComponentsT) => (
              <field.Textarea label="Opinia" placeholder="Opinia..." rows={3} showError />
            )}
          </form.AppField>

          <form.AppField name="status">
            {(field: AppFieldComponentsT) => (
              <field.Select label="Status" showError>
                <SelectItem value="active">Aktywna</SelectItem>
                <SelectItem value="completed">Zakończona</SelectItem>
              </field.Select>
            )}
          </form.AppField>
        </FieldGroup>

        <FormFooter label="Zapisz" submittingLabel="Zapisywanie..." className="mt-6" />
      </form>
    </form.AppForm>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/forms/investment-form/edit-investment-form.tsx
git commit -m "feat(investments): add EditInvestmentForm component"
```

---

## Task 6: Add Investment Dialog

**Files:**

- Create: `src/components/dialogs/add-investment-dialog.tsx`
- Reference: `src/components/dialogs/expense-dialog.tsx` (create pattern)

- [ ] **Step 1: Create add dialog**

```tsx
// src/components/dialogs/add-investment-dialog.tsx
'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { AddInvestmentForm } from '@/components/forms/investment-form/add-investment-form'

export function AddInvestmentDialog() {
  return (
    <FormDialog
      formId="add-investment"
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Dodaj
        </Button>
      }
      title="Nowa inwestycja"
    >
      {(onSubmitSuccess, keepOpen) => (
        <AddInvestmentForm onSubmitSuccess={onSubmitSuccess} keepOpen={keepOpen} />
      )}
    </FormDialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dialogs/add-investment-dialog.tsx
git commit -m "feat(investments): add AddInvestmentDialog component"
```

---

## Task 7: Edit Investment Dialog

**Files:**

- Create: `src/components/dialogs/edit-investment-dialog.tsx`
- Reference: `src/components/dialogs/edit-transfer-dialog.tsx` (edit pattern)

- [ ] **Step 1: Create edit dialog**

Uses `InvestmentRefT` directly — no duplicate type definition.

```tsx
// src/components/dialogs/edit-investment-dialog.tsx
'use client'

import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { EditInvestmentForm } from '@/components/forms/investment-form/edit-investment-form'
import type { InvestmentRefT } from '@/types/reference-data'

type EditInvestmentDialogPropsT = {
  investment: InvestmentRefT
}

export function EditInvestmentDialog({ investment }: EditInvestmentDialogPropsT) {
  return (
    <FormDialog
      formId={`edit-investment-${investment.id}`}
      showKeepOpen={false}
      trigger={
        <Button variant="ghost" size="icon" aria-label="Edytuj inwestycję">
          <Pencil className="h-4 w-4" />
        </Button>
      }
      title="Edytuj inwestycję"
      description={investment.name}
    >
      {(onSubmitSuccess, keepOpen) => (
        <EditInvestmentForm
          investment={investment}
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
        />
      )}
    </FormDialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dialogs/edit-investment-dialog.tsx
git commit -m "feat(investments): add EditInvestmentDialog component"
```

---

## Task 8: Wire Into Table — Row Type, Actions Column, Toolbar

**Files:**

- Modify: `src/lib/tables/investments.tsx` — add `notes` to `InvestmentRowT`, add actions column
- Modify: `src/lib/queries/dashboard.ts` — pass `notes` to row
- Modify: `src/components/investments/investment-data-table.tsx` — add toolbar button

- [ ] **Step 1: Add `notes` to `InvestmentRowT` and actions column**

In `src/lib/tables/investments.tsx`:

1. Add `notes: string` to `InvestmentRowT` (after `review: string`)
2. Add import: `import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'`
3. Add actions column as the **last** column in `getInvestmentColumns`, after the status column:

```tsx
col.display({
  id: 'actions',
  header: 'Akcje',
  cell: (info) => {
    const row = info.row.original
    return (
      <EditInvestmentDialog
        investment={{
          id: row.id,
          name: row.name,
          status: row.status,
          address: row.address,
          phone: row.phone,
          email: row.email,
          contactPerson: row.contactPerson,
          notes: row.notes,
          review: row.review,
        }}
      />
    )
  },
}),
```

- [ ] **Step 2: Pass `notes` in dashboard query**

In `src/lib/queries/dashboard.ts`, add `notes: inv.notes,` to the return object in the `allInvestments` mapping (after `review: inv.review,`).

- [ ] **Step 3: Add `AddInvestmentDialog` to toolbar**

In `src/components/investments/investment-data-table.tsx`:

1. Add import: `import { AddInvestmentDialog } from '@/components/dialogs/add-investment-dialog'`
2. In the toolbar render function, add `<AddInvestmentDialog />` immediately after `<ActiveFilterButton .../>`:

```tsx
toolbar={(table, cv) => (
  <>
    <SearchFilterInput value={searchTerm} onChange={setSearchTerm} placeholder="Szukaj..." />
    <ActiveFilterButton
      isActive={showOnlyActive}
      onChange={setShowOnlyActive}
      activeLabel="Aktywne"
      allLabel="Wszystkie"
    />
    <AddInvestmentDialog />
    <ColumnToggle table={table} columnVisibility={cv} />
  </>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/tables/investments.tsx src/lib/queries/dashboard.ts src/components/investments/investment-data-table.tsx
git commit -m "feat(investments): wire add/edit into table and toolbar"
```

---

## Task 9: Wire Into Detail Page

**Files:**

- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx`

- [ ] **Step 1: Add edit button to detail page**

`PageWrapper` renders `title` as a plain `<h1>` and has no `titleAction` slot. Place the `EditInvestmentDialog` as the first child inside `PageWrapper`, before `InfoList`. The `investment` variable is `InvestmentRefT` and has all fields needed.

```tsx
// Add import:
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'

// Place as first child inside PageWrapper, before InfoList:
<EditInvestmentDialog investment={investment} />
<InfoList items={infoFields.filter((f) => f.value)} />
```

This places the edit icon button below the title and above the info list. The button is a small ghost icon so it won't take much visual space.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(frontend\)/inwestycje/\[id\]/page.tsx
git commit -m "feat(investments): add edit button to detail page"
```

---

## Task 10: Manual Smoke Test

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Test add investment**

1. Navigate to dashboard
2. Find the investments table
3. Click `+ Dodaj` button next to Active filter
4. Fill in name (required), optionally other fields
5. Submit — dialog should close, table should update with new investment
6. Verify the new investment appears in Payload admin

- [ ] **Step 3: Test edit from table**

1. Click the edit (pencil) icon on any investment row
2. Modify some fields
3. Submit — dialog closes, row updates
4. Verify changes persisted in Payload admin

- [ ] **Step 4: Test edit from detail page**

1. Click into an investment detail page
2. Click the edit button
3. Modify fields, submit
4. Verify the info list updates after revalidation

- [ ] **Step 5: Test validation**

1. Open add dialog, leave name empty, submit
2. Should show "Nazwa jest wymagana" error on the name field
3. Enter an invalid email, submit — server should reject with email validation error
