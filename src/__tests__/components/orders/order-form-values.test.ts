import { describe, expect, it } from 'vitest'

import { referenceDataFor } from '@/__tests__/fixtures/reference-data'
import { orderFormValues } from '@/components/orders/order-form-values'

const referenceData = {
  ...referenceDataFor('MANAGER'),
  expenseCategories: [
    { id: 11, name: 'Robocizna' },
    { id: 12, name: 'materiały budowlane' },
  ],
  otherCategories: [
    { id: 21, name: 'Kontener 7 m³' },
    { id: 22, name: 'Big bag' },
  ],
}

describe('orderFormValues', () => {
  it('prefills an investment expense with the order line, amount and categories', () => {
    const values = orderFormValues({
      kind: 'bigBag',
      quantity: 3,
      unitPrice: 800,
      investmentId: 42,
      referenceData,
    })

    expect(values).toMatchObject({ type: 'INVESTMENT_EXPENSE', investment: '42' })
    expect(values.lineItems).toHaveLength(1)
    expect(values.lineItems[0]).toMatchObject({
      description: '3 × big bag',
      amount: '2400',
      expenseCategory: '12',
      category: '22',
    })
  })

  it('picks the container sub-category', () => {
    const values = orderFormValues({
      kind: 'container',
      quantity: 2,
      unitPrice: 1500,
      investmentId: 42,
      referenceData,
    })

    expect(values.lineItems[0]).toMatchObject({
      description: '2 × kontener',
      amount: '3000',
      category: '21',
    })
  })

  it('rounds the amount to grosze', () => {
    const values = orderFormValues({
      kind: 'bigBag',
      quantity: 3,
      unitPrice: 799.99,
      investmentId: 42,
      referenceData,
    })

    expect(values.lineItems[0].amount).toBe('2399.97')
  })
})
