import { describe, it, expect } from 'vitest'
import {
  investmentForType,
  sourceRegisterForType,
  staleFieldsForType,
} from '@/lib/transfers/clear-fields-for-type'

// EX-709: the expense dialog opened from /inwestycje/105 defaults `investment` to 105, so the
// type-change handler's form.resetField('investment') RESTORED that id instead of clearing it —
// the field went hidden with 105 still in it and the row saved carrying an investment its type
// never shows. The server-side counterpart (hooks/transfers/validate.ts) masks it on staging;
// production runs a branch that predates the guard, which is how #4302 was booked.
describe('investmentForType', () => {
  it('empties the investment for a type that never shows one', () => {
    expect(investmentForType('OTHER', '105', '105')).toBe('')
  })

  it('empties it for the company-level deposits too', () => {
    expect(investmentForType('OTHER_DEPOSIT', '105', '105')).toBe('')
    expect(investmentForType('COMPANY_FUNDING', '105', '105')).toBe('')
  })

  it('keeps the pick when the new type carries an investment', () => {
    expect(investmentForType('PAYOUT', '105', '')).toBe('105')
  })

  it('refills from the URL when the new type shows the field and nothing is picked', () => {
    expect(investmentForType('INVESTMENT_EXPENSE', '', '105')).toBe('105')
  })

  it('leaves it empty off an investment page', () => {
    expect(investmentForType('INVESTMENT_EXPENSE', '', '')).toBe('')
  })
})

describe('sourceRegisterForType', () => {
  it('empties the kasa for a type that is not a cash movement', () => {
    expect(sourceRegisterForType('LABOR_COST', '5', '5')).toBe('')
  })

  it('keeps the pick when the new type carries a kasa', () => {
    expect(sourceRegisterForType('INVESTMENT_EXPENSE', '5', '9')).toBe('5')
  })

  // The blank a detour through a register-less type leaves behind is what makes this refill the
  // point of the field: without it, pinning a default kasa stops holding the moment the type is
  // touched twice.
  it("refills from the user's default once the field is empty again", () => {
    expect(sourceRegisterForType('INVESTMENT_EXPENSE', '', '9')).toBe('9')
  })

  it('stays empty when the user has no default kasa', () => {
    expect(sourceRegisterForType('INVESTMENT_EXPENSE', '', '')).toBe('')
  })
})

describe('staleFieldsForType', () => {
  const patch = (type: string) => Object.fromEntries(staleFieldsForType(type))

  it('empties the fields the type does not carry', () => {
    expect(patch('OTHER')).toEqual({
      targetRegister: '',
      worker: '',
      settled: false,
      paymentMethod: '',
    })
  })

  it('empties the kasa for a type that is not a cash movement', () => {
    expect(patch('LABOR_COST')).toHaveProperty('sourceRegister', '')
  })

  it('leaves the kasa and the settled flag alone where the type carries them', () => {
    expect(patch('INVESTMENT_EXPENSE')).toEqual({
      targetRegister: '',
      worker: '',
      paymentMethod: '',
    })
  })

  it('unsets settled when the new type cannot be settled', () => {
    expect(patch('INVESTMENT_EXPENSE_NET')).toHaveProperty('settled', false)
  })

  // The one home for „blank what this type does not carry": a method picked on the netto wydatek
  // must not ride along after a switch, or it reaches the row a type change made silent.
  it('keeps the metoda where the type carries it', () => {
    expect(patch('INVESTMENT_EXPENSE_NET')).not.toHaveProperty('paymentMethod')
    expect(patch('INVESTOR_DEPOSIT')).not.toHaveProperty('paymentMethod')
  })

  it('keeps the worker on a payout', () => {
    expect(patch('PAYOUT')).not.toHaveProperty('worker')
  })

  it('keeps the worker and drops the kasa on a premia', () => {
    expect(patch('BONUS')).not.toHaveProperty('worker')
    expect(patch('BONUS')).toHaveProperty('sourceRegister', '')
  })

  // Retention is the intended reading, not a side effect of the EX-709 fix (owner, 2026-08-24): the
  // patch names only what the NEW type cannot carry, so a field both types carry keeps the pick and
  // the user does not re-enter what he just chose. The old handler cleared all four unconditionally,
  // which is the behaviour these two cases exist to keep from creeping back.
  it('keeps the kasa when both types carry one', () => {
    expect(patch('CORRECTION')).not.toHaveProperty('sourceRegister')
    expect(patch('INVESTMENT_EXPENSE')).not.toHaveProperty('sourceRegister')
  })

  it('keeps the settled flag between two settleable types', () => {
    expect(patch('CORRECTION')).not.toHaveProperty('settled')
    expect(patch('INVESTMENT_EXPENSE')).not.toHaveProperty('settled')
  })
})
