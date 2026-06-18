import { describe, it, expect } from 'vitest'
import { mapLineItem } from '@/components/forms/expense-form/map-line-item'

const item = {
  description: 'x',
  amount: '-1000',
  invoiceNote: '',
  category: '',
  expenseCategory: '7',
}

describe('mapLineItem', () => {
  it('keeps expenseCategory for a CORRECTION line item WHEN it has an investment', () => {
    expect(mapLineItem(item, 'CORRECTION', true).expenseCategory).toBe(7)
  })

  it('drops expenseCategory for a CORRECTION line item with no investment', () => {
    expect(mapLineItem(item, 'CORRECTION', false).expenseCategory).toBeUndefined()
  })

  it('keeps expenseCategory for an INVESTMENT_EXPENSE line item (any investment flag)', () => {
    expect(mapLineItem(item, 'INVESTMENT_EXPENSE').expenseCategory).toBe(7)
  })

  it('drops expenseCategory for a type that does not use it (OTHER)', () => {
    expect(mapLineItem(item, 'OTHER', true).expenseCategory).toBeUndefined()
  })

  it('coerces amount to a number', () => {
    expect(mapLineItem(item, 'CORRECTION', true).amount).toBe(-1000)
  })
})
