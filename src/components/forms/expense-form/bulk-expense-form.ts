import { formOptions } from '@tanstack/react-form'
import type { FormApiOfT } from '@/components/forms/hooks/form-api-of'
import { randomId } from '@/lib/utils/random-id'

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
    // Netto billed to the investor — only the netto expense type reads it; blank everywhere else.
    netAmount: string
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
    id: randomId(),
    description: '',
    amount: '',
    netAmount: '',
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

export type BulkExpenseFormApiT = FormApiOfT<BulkExpenseFormValuesT>
