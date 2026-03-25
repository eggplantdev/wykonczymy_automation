# Investment CRUD — Frontend Design Spec

## Overview

Add and edit investments from the frontend using dialog-based forms. Follows the existing transfer edit pattern: `FormDialog` → form component → `useFormSubmit` → `protectedAction` → cache revalidation.

## Decisions

- **Same fields** for add and edit forms (name, address, phone, email, contactPerson, notes, review, status)
- **All management roles** (admin, owner, manager) can add and edit
- **No `updatedBy` tracking** — deferred to future work
- **No delete** from frontend — only via Payload admin (admin/owner)
- **Separate form components** for add and edit, sharing a `InvestmentFormFields` field layout
- **Dialog-based** — both add and edit use `FormDialog` with optimistic close pattern
- **`InvestmentRowT` extended** with `notes` field so table edit dialog can populate all form fields

## Entry Points

### 1. Add Investment (dashboard table toolbar)

`AddInvestmentDialog` renders a `+ Dodaj` button in the investments table toolbar, positioned left-aligned next to the Active/All filter toggle.

- `formId`: `'add-investment'` (static — only one add dialog)
- `showKeepOpen`: `true` (allows adding multiple investments in sequence)

### 2. Edit Investment (table actions column)

New actions column at the end of the investments table. Renders `EditInvestmentDialog` with an edit icon button per row. All management roles can edit any investment.

- `formId`: `` `edit-investment-${id}` `` (dynamic per row)
- `showKeepOpen`: `false` (matches transfer edit pattern)
- Dialog description: investment name

### 3. Edit Investment (detail page)

`EditInvestmentDialog` rendered in the investment detail page header area. The detail page is a Server Component — `EditInvestmentDialog` is a Client Component embedded directly (Server Components can render Client Components as children). Data source: `InvestmentRefT` from `refData.investments.find(...)`, which has all fields including `notes`.

## New Files

### Components

```
src/components/forms/investment-form/
  investment-form-fields.tsx    — shared field layout (8 fields wrapped in FieldGroup)
  add-investment-form.tsx       — add form with empty defaults
  edit-investment-form.tsx      — edit form with row-populated defaults
  investment-schema.ts          — client-side Zod schema

src/components/dialogs/
  add-investment-dialog.tsx     — FormDialog with + Dodaj trigger
  edit-investment-dialog.tsx    — FormDialog with edit icon trigger
```

### Server Actions

```
src/lib/actions/investments.ts ('use server')
  - createInvestmentAction(data) → ActionResultT
  - updateInvestmentAction(id, data) → ActionResultT
```

### Server Schema

```
src/lib/schemas/investment.ts
  - investmentSchema (shared for create and update)
```

## Modified Files

| File                                                   | Change                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `src/lib/tables/investments.tsx`                       | Add `notes` to `InvestmentRowT`, add actions column with edit dialog |
| `src/lib/queries/dashboard.ts`                         | Pass `notes` through to `InvestmentRowT`                             |
| `src/components/investments/investment-data-table.tsx` | Add `AddInvestmentDialog` to toolbar, pass new column options        |
| `src/app/(frontend)/inwestycje/[id]/page.tsx`          | Add `EditInvestmentDialog` button                                    |

## Form Fields

All fields are plain text inputs — no comboboxes, no reference data lookups needed. Fields wrapped in `FieldGroup`.

| Field         | Type                      | Required | Default (add) |
| ------------- | ------------------------- | -------- | ------------- |
| name          | Input (text)              | Yes      | `''`          |
| address       | Input (text)              | No       | `''`          |
| phone         | Input (text)              | No       | `''`          |
| email         | Input (email)             | No       | `''`          |
| contactPerson | Input (text)              | No       | `''`          |
| notes         | Textarea                  | No       | `''`          |
| review        | Textarea                  | No       | `''`          |
| status        | Select (active/completed) | Yes      | `'active'`    |

## Validation

### Client Schema (form strings)

```typescript
export const investmentFormSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
  contactPerson: z.string(),
  notes: z.string(),
  review: z.string(),
  status: z.string(),
})

export type InvestmentFormValuesT = z.infer<typeof investmentFormSchema>
```

### Server Schema (typed values)

```typescript
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

## Server Actions

Both actions use `'use server'` directive, `protectedAction` wrapper with `MANAGEMENT_ROLES`, `perfStart()` logging, and `validateAction` for schema validation. Cache revalidation tag: `['investments']`.

### createInvestmentAction

```typescript
export async function createInvestmentAction(data: InvestmentFormDataT): Promise<ActionResultT> {
  return protectedAction(
    'createInvestmentAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed

      await payload.create({
        collection: 'investments',
        data: parsed.data,
      })

      return { success: true }
    },
    ['investments'],
  )
}
```

### updateInvestmentAction

```typescript
export async function updateInvestmentAction(
  id: number,
  data: InvestmentFormDataT,
): Promise<ActionResultT> {
  return protectedAction(
    'updateInvestmentAction',
    async ({ payload }) => {
      const parsed = validateAction(investmentSchema, data)
      if (!parsed.success) return parsed

      await payload.update({
        collection: 'investments',
        id,
        data: parsed.data,
      })

      return { success: true }
    },
    ['investments'],
  )
}
```

## Data Flow

### Add

1. User clicks `+ Dodaj` in toolbar
2. `FormDialog` opens with `AddInvestmentForm`
3. User fills fields, submits
4. `useFormSubmit` closes dialog optimistically
5. `createInvestmentAction` runs in background
6. On success: toast, cache revalidation, table refreshes
7. On error: dialog reopens with recovered values, error toast

### Edit (table)

1. User clicks edit icon in actions column
2. `FormDialog` opens with `EditInvestmentForm` pre-filled from `InvestmentRowT` (includes `notes` and `review`)
3. Same submit flow as add, but calls `updateInvestmentAction(id, data)`

### Edit (detail page)

1. User clicks edit button in page header
2. Same `EditInvestmentDialog`, pre-filled from `InvestmentRefT`
3. Same submit flow

## Component Composition

```
AddInvestmentDialog
  └── FormDialog (formId: 'add-investment', showKeepOpen: true, trigger: + Dodaj button)
        └── AddInvestmentForm
              ├── useFormSubmit('add-investment')
              ├── useCheckFormErrors(form)
              ├── useAppForm({ defaultValues: empty, validators: { onSubmit: investmentFormSchema } })
              ├── InvestmentFormFields (shared field layout in FieldGroup)
              └── FormFooter (label: 'Dodaj', submittingLabel: 'Dodawanie...')

EditInvestmentDialog
  └── FormDialog (formId: 'edit-investment-${id}', showKeepOpen: false, trigger: edit icon, description: investment name)
        └── EditInvestmentForm
              ├── useFormSubmit('edit-investment-${id}')
              ├── useCheckFormErrors(form)
              ├── useAppForm({ defaultValues: from row/ref, validators: { onSubmit: investmentFormSchema } })
              ├── InvestmentFormFields (same shared layout)
              └── FormFooter (label: 'Zapisz', submittingLabel: 'Zapisywanie...')
```

## Authorization

- Frontend: all management roles see add button and edit buttons (no per-row gating needed)
- Server: `protectedAction` with `MANAGEMENT_ROLES` guard on both actions
- Payload access control unchanged (already allows admin/owner/manager for create/update)
