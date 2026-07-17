import { describe, it, expect } from 'vitest'
import { discountFromValue, discountFromType } from '@/lib/kosztorys/discount-edit'

// Regression guard for the orphan bug: discountType and discountValue are independent fields, so
// the grid could hold a value with no type — applyDiscount ignores it, and the row showed a rabat
// of 10 next to a computed discount of 0.00. Both edit directions must keep the pair consistent.

const NO_DISCOUNT = { discountType: null, discountValue: 0 } as const

describe('discountFromValue', () => {
  it('implies percent when a value is typed with no type set', () => {
    expect(discountFromValue(NO_DISCOUNT, '10')).toEqual({
      discountType: 'percent',
      discountValue: 10,
    })
  })

  it('keeps an existing type instead of overriding it with percent', () => {
    expect(discountFromValue({ discountType: 'amount', discountValue: 0 }, '250')).toEqual({
      discountType: 'amount',
      discountValue: 250,
    })
  })

  it('drops the whole discount when the field is cleared', () => {
    expect(discountFromValue({ discountType: 'percent', discountValue: 10 }, '')).toEqual(
      NO_DISCOUNT,
    )
  })

  it('accepts a comma decimal separator', () => {
    expect(discountFromValue(NO_DISCOUNT, '12,5')).toEqual({
      discountType: 'percent',
      discountValue: 12.5,
    })
  })

  it('rejects garbage rather than clearing the discount', () => {
    expect(discountFromValue({ discountType: 'percent', discountValue: 10 }, 'abc')).toBeNull()
  })
})

describe('discountFromType', () => {
  it('clears the value when the type is cleared, leaving no orphan', () => {
    expect(discountFromType({ discountType: 'percent', discountValue: 10 }, null)).toEqual(
      NO_DISCOUNT,
    )
  })

  it('keeps the value when switching between percent and amount', () => {
    expect(discountFromType({ discountType: 'percent', discountValue: 10 }, 'amount')).toEqual({
      discountType: 'amount',
      discountValue: 10,
    })
  })
})
