import { describe, it, expect } from 'vitest'
import { planeFillIn, UNANSWERED_PAYMENT_METHOD } from '@/lib/transfers/plane-fill-in'

const legacy = { type: 'INVESTOR_DEPOSIT', vatPlane: null, paymentMethod: 'CASH' } as const

describe('planeFillIn — a save that did not ask the question may not answer it', () => {
  // the plane is write-once, so a save that merely attaches a faktura would freeze
  // whatever the form pre-selected.
  it('leaves a legacy wpłata plane-less while the question stands unanswered', () => {
    const result = planeFillIn(legacy, UNANSWERED_PAYMENT_METHOD, '')

    expect(result).toEqual({})
  })

  it('tags it brutto with its netto once the owner says przelew', () => {
    expect(planeFillIn(legacy, 'TRANSFER', '400')).toEqual({
      paymentMethod: 'TRANSFER',
      vatPlane: 'GROSS',
      netAmount: 400,
    })
  })

  it('tags it netto and sends no second kwota once the owner says gotówka', () => {
    expect(planeFillIn(legacy, 'CASH', '')).toEqual({
      paymentMethod: 'CASH',
      vatPlane: 'NET',
      netAmount: undefined,
    })
  })

  it('drops a netto stranded by a switch back to gotówka', () => {
    expect(planeFillIn(legacy, 'CASH', '400').netAmount).toBeUndefined()
  })

  it.each([
    ['a wpłata that already has a plane', { ...legacy, vatPlane: 'NET' as const }],
    ['a type that has no plane at all', { ...legacy, type: 'INVESTMENT_EXPENSE' as const }],
  ])('never answers for %s, even when the form names one', (_label, row) => {
    expect(planeFillIn(row, 'TRANSFER', '400')).toEqual({})
  })
})
