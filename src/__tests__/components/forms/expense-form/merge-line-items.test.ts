import { describe, expect, it } from 'vitest'
import { makeLineItem } from '@/components/forms/expense-form/bulk-expense-form'
import { mergeLineItems } from '@/components/forms/expense-form/merge-line-items'

describe('mergeLineItems', () => {
  it('sums Kwota in grosze, not in floats', () => {
    const { values, isAmountIncomplete } = mergeLineItems([
      makeLineItem({ amount: '0.1' }),
      makeLineItem({ amount: '0.2' }),
      makeLineItem({ amount: '12.35' }),
    ])

    expect(values.amount).toBe('12.65')
    expect(isAmountIncomplete).toBe(false)
  })

  it('counts a blank Kwota as 0 and flags the sum as incomplete', () => {
    const { values, isAmountIncomplete } = mergeLineItems([
      makeLineItem({ amount: '10' }),
      makeLineItem({ amount: '' }),
    ])

    expect(values.amount).toBe('10')
    expect(isAmountIncomplete).toBe(true)
  })

  it('leaves Kwota blank when no row has one', () => {
    expect(mergeLineItems([makeLineItem(), makeLineItem()]).values.amount).toBe('')
  })

  it('sums Netto only when every row has one', () => {
    const both = mergeLineItems([
      makeLineItem({ amount: '12.3', netAmount: '10' }),
      makeLineItem({ amount: '24.6', netAmount: '20' }),
    ])
    const one = mergeLineItems([
      makeLineItem({ amount: '12.3', netAmount: '10' }),
      makeLineItem({ amount: '24.6' }),
    ])

    expect(both.values.netAmount).toBe('30')
    expect(one.values.netAmount).toBe('')
  })

  it('takes text fields from the first row that has them and joins the notes', () => {
    const { values } = mergeLineItems([
      makeLineItem({ description: '', invoiceNote: 'bilet 1', expenseCategory: '5' }),
      makeLineItem({
        description: 'Parking',
        invoiceNote: 'bilet 2',
        documentDate: '2026-10-01',
        sellerNip: '5213456789',
        expenseCategory: '7',
      }),
      makeLineItem({ description: 'Leroy', documentDate: '2026-10-02' }),
    ])

    expect(values).toMatchObject({
      description: 'Parking',
      documentDate: '2026-10-01',
      sellerNip: '5213456789',
      expenseCategory: '5',
      invoiceNote: 'bilet 1\nbilet 2',
    })
  })

  it('keeps the document number only when every filled one is the same', () => {
    const same = mergeLineItems([
      makeLineItem({ documentNumber: 'FV 1' }),
      makeLineItem({ documentNumber: '' }),
      makeLineItem({ documentNumber: 'FV 1' }),
    ])
    const different = mergeLineItems([
      makeLineItem({ documentNumber: 'FV 1' }),
      makeLineItem({ documentNumber: 'FV 2' }),
    ])

    expect(same.values.documentNumber).toBe('FV 1')
    expect(different.values.documentNumber).toBe('')
  })
})
