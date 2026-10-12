import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { referenceDataFor } from '@/__tests__/helpers/reference-data'

export const expenseReferenceData = {
  ...referenceDataFor('OWNER'),
  cashRegisters: [
    { id: 1, name: 'Kasa główna', type: 'MAIN' as const },
    { id: 7, name: 'Kasa Jana', type: 'AUXILIARY' as const },
  ],
  investments: [{ id: 3, name: 'Mieszkanie Mokotów', status: 'active' as const }],
} as unknown as ReturnType<typeof referenceDataFor>

/** A wydatek inwestycyjny on „Mieszkanie Mokotów", paid from „Kasa Jana" — the shape a zgłoszenie prefills. */
export function expenseValues(
  overrides: Partial<BulkExpenseFormValuesT> = {},
): BulkExpenseFormValuesT {
  return {
    date: '2026-10-05',
    type: 'INVESTMENT_EXPENSE',
    paymentMethod: 'CASH',
    sourceRegister: '7',
    targetRegister: '',
    investment: '3',
    worker: '',
    settled: false,
    lineItems: [makeLineItem({ description: '' })],
    ...overrides,
  }
}
