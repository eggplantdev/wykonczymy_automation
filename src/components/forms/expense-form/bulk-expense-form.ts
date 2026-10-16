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
    netAmount: string
    invoiceNote: string
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
  incompleteIds: Set<string>
  disabled: boolean
  onToggle: (id: string) => void
  onMerge: () => void
  onSplit: (id: string) => void
  onDecide?: (ids: string[], decision: 'accept' | 'reject') => void
  isAcceptBlocked?: (id: string) => boolean
  isRegroupBlocked?: boolean
  readRowOf: (id: string) => number | undefined
  statusOf: (id: string) => DecisionStatusT
  undoFor?: (id: string) => (() => void) | undefined
}

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
