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

## Entry Points

### 1. Add Investment (dashboard table toolbar)

`AddInvestmentDialog` renders a `+ Dodaj` button in the investments table toolbar, positioned left-aligned next to the Active/All filter toggle.

### 2. Edit Investment (table actions column)

New actions column at the end of the investments table. Renders `EditInvestmentDialog` with an edit icon button per row. All management roles can edit any investment.

### 3. Edit Investment (detail page)

`EditInvestmentDialog` rendered in the investment detail page header area. Uses the same `InvestmentRefT` data already available on the page.

## New Files

### Components

```
src/components/forms/investment-form/
  investment-form-fields.tsx    — shared field layout (8 fields)
  add-investment-form.tsx       — add form with empty defaults
  edit-investment-form.tsx      — edit form with row-populated defaults
  investment-schema.ts          — client-side Zod schema

src/components/dialogs/
  add-investment-dialog.tsx     — FormDialog with + Dodaj trigger
  edit-investment-dialog.tsx    — FormDialog with edit icon trigger
```

### Server Actions

```
src/lib/actions/investments.ts
  - createInvestmentAction(data) → ActionResultT
  - updateInvestmentAction(id, data) → ActionResultT
```

### Server Schema

```
src/lib/schemas/investment.ts
  - createInvestmentSchema
  - updateInvestmentSchema
```

## Modified Files

| File                                                   | Change                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| `src/lib/tables/investments.tsx`                       | Add actions column with `EditInvestmentDialog`                |
| `src/components/investments/investment-data-table.tsx` | Add `AddInvestmentDialog` to toolbar, pass new column options |
| `src/app/(frontend)/inwestycje/[id]/page.tsx`          | Add `EditInvestmentDialog` button                             |

## Form Fields

All fields are plain text inputs — no comboboxes, no reference data lookups needed.

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
  email: z.string().optional().default(''),
  contactPerson: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  review: z.string().optional().default(''),
  status: z.enum(['active', 'completed']),
})

export type InvestmentFormDataT = z.infer<typeof investmentSchema>
```

## Server Actions

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
2. `FormDialog` opens with `EditInvestmentForm` pre-filled from `InvestmentRowT`
3. Same submit flow as add, but calls `updateInvestmentAction(id, data)`

### Edit (detail page)

1. User clicks edit button in page header
2. Same `EditInvestmentDialog`, pre-filled from `InvestmentRefT`
3. Same submit flow

## Component Composition

```
AddInvestmentDialog
  └── FormDialog (trigger: + Dodaj button)
        └── AddInvestmentForm
              ├── useFormSubmit(FORM_ID)
              ├── useAppForm({ defaultValues: empty, validators: investmentFormSchema })
              └── InvestmentFormFields (shared field layout)
                    ├── form.AppField name="name" → Input
                    ├── form.AppField name="address" → Input
                    ├── form.AppField name="phone" → Input
                    ├── form.AppField name="email" → Input
                    ├── form.AppField name="contactPerson" → Input
                    ├── form.AppField name="notes" → Textarea
                    ├── form.AppField name="review" → Textarea
                    └── form.AppField name="status" → Select

EditInvestmentDialog
  └── FormDialog (trigger: edit icon button)
        └── EditInvestmentForm
              ├── useFormSubmit(FORM_ID)
              ├── useAppForm({ defaultValues: from row, validators: investmentFormSchema })
              └── InvestmentFormFields (same shared layout)
```

## Authorization

- Frontend: all management roles see add button and edit buttons (no per-row gating needed)
- Server: `protectedAction` with `MANAGEMENT_ROLES` guard on both actions
- Payload access control unchanged (already allows admin/owner/manager for create/update)
