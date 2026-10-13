import { describe, expect, it } from 'vitest'
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { toBulkData } from '@/components/forms/expense-form/to-bulk-data'

const value: BulkExpenseFormValuesT = {
  date: '2026-10-13',
  type: 'INVESTMENT_EXPENSE',
  paymentMethod: '',
  sourceRegister: '4',
  targetRegister: '',
  investment: '12',
  worker: '',
  settled: false,
  lineItems: [],
}

describe('toBulkData', () => {
  it('converts the form strings and books only the rows it is given', () => {
    const booked = makeLineItem({ description: 'Klej', amount: '45.50', expenseCategory: '3' })
    const data = toBulkData({ ...value, lineItems: [booked, makeLineItem()] }, [booked])

    expect(data).toMatchObject({
      date: '2026-10-13',
      paymentMethod: null,
      sourceRegister: 4,
      targetRegister: undefined,
      investment: 12,
      worker: undefined,
    })
    expect(data.lineItems).toHaveLength(1)
    expect(data.lineItems[0]).toMatchObject({ description: 'Klej', amount: 45.5 })
  })
})
