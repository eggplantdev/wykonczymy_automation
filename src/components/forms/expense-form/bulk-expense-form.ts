import type { DecisionStatusT } from '@/components/ui/decision-progress-badge'
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
    // Document identity for the duplicate check (EX-1025). `documentDate` is ISO `YYYY-MM-DD`.
    documentNumber: string
    sellerNip: string
    documentDate: string
    category: string
    expenseCategory: string
    worker: string
  }[]
}

export type BulkLineItemT = BulkExpenseFormValuesT['lineItems'][number]

export type ReceiptGroupingT = {
  selectableIds: Set<string>
  selectedIds: Set<string>
  mergedIds: Set<string>
  // Merged rows whose sum is short a Kwota.
  incompleteIds: Set<string>
  disabled: boolean
  onToggle: (id: string) => void
  onMerge: () => void
  onSplit: (id: string) => void
  // Set when each paragon is booked or refused on its own.
  onDecide?: (ids: string[], decision: 'accept' | 'reject') => void
  // A booking files the pages as its invoices; a refusal names them by id and needs none.
  isAcceptBlocked?: (id: string) => boolean
  // The paragon's place in the worker's photos, so the rows keep the worker's order.
  readRowOf: (id: string) => number | undefined
  statusOf: (id: string) => DecisionStatusT
  undoFor?: (id: string) => (() => void) | undefined
}

// A fresh row with a stable client-side `id` that keys its out-of-form state (invoice file,
// generation markers). Call it per push — reusing one object would collide ids across rows.
export function makeLineItem(overrides?: Partial<BulkLineItemT>): BulkLineItemT {
  return {
    id: randomId(),
    description: '',
    amount: '',
    netAmount: '',
    invoiceNote: '',
    documentNumber: '',
    sellerNip: '',
    documentDate: '',
    category: '',
    expenseCategory: '',
    worker: '',
    ...overrides,
  }
}

export function isBlankRow(row: Pick<BulkLineItemT, 'description' | 'amount'>): boolean {
  return !row.description && !row.amount
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
