import { describe, it, expect } from 'vitest'
import { discountFromType, discountPolicy } from '@/lib/kosztorys/discount-edit'

// Regression guard for the orphan bug: discountType and discountValue are independent fields, so
// the grid could hold a value with no type — applyDiscount ignores it, and the row showed a rabat
// of 10 next to a computed discount of 0.00. Both edit directions must keep the pair consistent —
// the value direction is `discountPolicy` and lives in cell-edit.test.ts.

const NO_DISCOUNT = { discountType: null, discountValue: 0 } as const

describe('discountFromType', () => {
  it('clears the value when the type is cleared, leaving no orphan', () => {
    expect(discountFromType({ discountType: 'percent', discountValue: 10 }, null)).toEqual({
      kind: 'change',
      pair: NO_DISCOUNT,
    })
  })

  it('keeps the value when switching between percent and amount', () => {
    expect(discountFromType({ discountType: 'percent', discountValue: 10 }, 'amount')).toEqual({
      kind: 'change',
      pair: { discountType: 'amount', discountValue: 10 },
    })
  })

  // A rabat of 150 zł flipped to „%" is the one route to 150% with no keystroke passing the guard
  // (EX-736). Refused rather than capped — capping would give the row away for free.
  it('refuses the switch INTO percent when the carried value is above the ceiling', () => {
    const switched = discountFromType({ discountType: 'amount', discountValue: 150 }, 'percent')
    expect(switched.kind).toBe('blocked')
  })

  it('leaves the pair untouched on a refused switch', () => {
    const current = { discountType: 'amount', discountValue: 150 } as const
    const switched = discountFromType(current, 'percent')
    expect(switched).not.toHaveProperty('pair')
    expect(current).toEqual({ discountType: 'amount', discountValue: 150 })
  })

  it('allows the switch at exactly the ceiling', () => {
    expect(discountFromType({ discountType: 'amount', discountValue: 100 }, 'percent')).toEqual({
      kind: 'change',
      pair: { discountType: 'percent', discountValue: 100 },
    })
  })

  it('leaves a value the percent plane accepts alone', () => {
    expect(discountFromType({ discountType: 'amount', discountValue: 40 }, 'percent')).toEqual({
      kind: 'change',
      pair: { discountType: 'percent', discountValue: 40 },
    })
  })
})

// „-50" is the opposite of a concession: it becomes a 50% markup on the client's offer. Ceiling is
// percent-only, floor is on both planes.
describe('discountPolicy guard — the floor', () => {
  const policy = discountPolicy<{
    discountType: 'percent' | 'amount' | null
    discountValue: number
  }>()
  const guard = (row: { discountType: 'percent' | 'amount' | null; discountValue: number }) =>
    policy.guard!(row)

  it('refuses a negative rabat on the percent plane', () => {
    expect(guard({ discountType: 'percent', discountValue: -50 })).toEqual({
      severity: 'refuse',
      message: 'Rabat nie może być ujemny.',
    })
  })

  it('refuses a negative rabat on the amount plane too, where no ceiling applies', () => {
    expect(guard({ discountType: 'amount', discountValue: -50 })).toEqual({
      severity: 'refuse',
      message: 'Rabat nie może być ujemny.',
    })
  })

  it('accepts 250 zł, which is only out of range as a percentage', () => {
    expect(guard({ discountType: 'amount', discountValue: 250 })).toBeNull()
    expect(guard({ discountType: 'percent', discountValue: 250 })).toEqual({
      severity: 'refuse',
      message: 'Rabat nie może przekroczyć 100%.',
    })
  })

  it('accepts zero and a full giveaway', () => {
    expect(guard({ discountType: 'percent', discountValue: 0 })).toBeNull()
    expect(guard({ discountType: 'percent', discountValue: 100 })).toBeNull()
  })
})
