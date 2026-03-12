# Edit Form Refactor — Design Spec

**Date:** 2026-03-12
**Branch:** `feature/edit-transactions`
**Status:** Approved

## Problem

The edit transfer implementation (`edit-transfer-button.tsx`) violates project form patterns:

1. **Button + Dialog + Form in one component** — should follow `FormDialog → Form` separation
2. **Raw `useState` instead of TanStack Form + Zod** — inconsistent with all other forms
3. **`renderItemInline`/`renderItemSecondRow` in ExpenseForm** — category rendering leaks outside LineItemsField via render props with ugly type casts (pre-existing)

## Changes

### 1. Edit Form Split

**`EditTransferDialog`** (`src/components/dialogs/edit-transfer-dialog.tsx`)

- When `canEdit=true`: renders `FormDialog` with pencil button trigger, `showKeepOpen={false}`
- When `canEdit=false`: renders disabled pencil button with tooltip
- Passes `row` + `referenceData` to form

**`EditTransferForm`** (`src/components/forms/edit-transfer-form/edit-transfer-form.tsx`)

- Pure form component using `useAppForm` + Zod client schema
- Uses `useFormSubmit` optimistic pattern (same as all other forms)
- Receives `row`, `referenceData`, `onSuccess`, `keepOpen`
- Calls `updateTransferAction` on submit

Form remounts each time dialog opens (Radix unmounts DialogContent on close), so `defaultValues` from row are always fresh.

### 2. Edit Form Schema

Client-side schema added to `expense-schema.ts`:

```typescript
export const editTransferFormSchema = z
  .object({
    description: z.string(),
    date: z.string(),
    paymentMethod: z.string(),
    investment: z.string(),
    expenseCategory: z.string(),
    otherCategory: z.string(),
    invoiceNote: z.string(),
  })
  .superRefine((data, ctx) => {
    refineDate(data, ctx)
  })
```

No amount, type, or registers — those are immutable. Only `refineDate` validation needed.

### 3. LineItemsField Encapsulation

Replace render props with declarative category config:

```typescript
type CategoryFieldConfigT = {
  fieldName: string // e.g. "expenseCategory" — index interpolated internally
  label: string
  placeholder: string
  options: ReadonlyArray<{ id: number; name: string }>
}

type LineItemsFieldPropsT = {
  // ...existing props minus renderItemInline/renderItemSecondRow
  inlineCategory?: CategoryFieldConfigT
  secondRowCategory?: CategoryFieldConfigT
}
```

Parent (ExpenseForm) decides **what** to show based on transfer type. LineItemsField decides **how** to render it.

## Files

### Create

- `src/components/forms/edit-transfer-form/edit-transfer-form.tsx`
- `src/components/dialogs/edit-transfer-dialog.tsx`

### Modify

- `src/components/forms/form-fields/line-items-field.tsx` — add category config, remove render props
- `src/components/forms/expense-form/expense-form.tsx` — replace render props with config
- `src/components/forms/expense-form/expense-schema.ts` — add `editTransferFormSchema`
- `src/lib/tables/transfers.tsx` — import `EditTransferDialog` instead of `EditTransferButton`

### Delete

- `src/components/transfers/edit-transfer-button.tsx` — replaced by dialog + form
