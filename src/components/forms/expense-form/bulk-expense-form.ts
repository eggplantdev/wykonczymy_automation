import * as React from 'react'
import { formOptions } from '@tanstack/react-form'
import { withForm } from '@/components/forms/hooks/form-hooks'

export type BulkExpenseFormValuesT = {
  date: string
  type: string
  paymentMethod: string
  sourceRegister: string
  targetRegister: string
  investment: string
  worker: string
  settled: boolean
  lineItems: {
    id: string
    description: string
    amount: string
    invoiceNote: string
    category: string
    expenseCategory: string
  }[]
}

export type BulkLineItemT = BulkExpenseFormValuesT['lineItems'][number]

// A fresh row with a stable client-side `id` that keys its out-of-form state (invoice file,
// generation markers). Call it per push — reusing one object would collide ids across rows.
export function makeLineItem(overrides?: Partial<BulkLineItemT>): BulkLineItemT {
  return {
    id: crypto.randomUUID(),
    description: '',
    amount: '',
    invoiceNote: '',
    category: '',
    expenseCategory: '',
    ...overrides,
  }
}

export const bulkExpenseFormOptions = formOptions({
  defaultValues: {
    date: '',
    type: '',
    paymentMethod: '',
    sourceRegister: '',
    targetRegister: '',
    investment: '',
    worker: '',
    settled: false,
    lineItems: [makeLineItem()],
    // `as` (not `satisfies`) so TFormData is exactly BulkExpenseFormValuesT — `satisfies` would
    // keep `settled: false` as a literal and reject the parent form's `settled: boolean`.
  } as BulkExpenseFormValuesT,
})

// The concrete useAppForm instance type, fully inferred. TanStack's form API is a ~16-param
// generic that can't be restated by hand (form.AppField's `name` is a DeepKeys union, so a
// structural `{ name: string }` shape is rejected as too wide). withForm already solves this —
// it accepts the parent's form regardless of its validator generics — so we mint one throwaway
// withForm component and read the form type off its props. The probe is never rendered.
const _bulkExpenseFormProbe = withForm({ ...bulkExpenseFormOptions, render: () => null })
export type BulkExpenseFormApiT = React.ComponentProps<typeof _bulkExpenseFormProbe>['form']
