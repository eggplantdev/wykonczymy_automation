import { describe, it, expect } from 'vitest'
import {
  investmentForType,
  sourceRegisterForType,
  staleFieldsForType,
} from '@/lib/transfers/clear-fields-for-type'

describe('investmentForType', () => {
  it.each([
    ['empties the investment for a type that never shows one', 'OTHER', '105', '105', ''],
    ['empties it for a company-level deposit', 'OTHER_DEPOSIT', '105', '105', ''],
    ['empties it for company funding', 'COMPANY_FUNDING', '105', '105', ''],
    ['keeps the pick when the new type carries an investment', 'PAYOUT', '105', '', '105'],
    [
      'refills from the URL when the new type shows the field and nothing is picked',
      'INVESTMENT_EXPENSE',
      '',
      '105',
      '105',
    ],
    ['leaves it empty off an investment page', 'INVESTMENT_EXPENSE', '', '', ''],
  ])('%s', (_case, type, picked, fromUrl, expected) => {
    expect(investmentForType(type, picked, fromUrl)).toBe(expected)
  })
})

describe('sourceRegisterForType', () => {
  it.each([
    ['empties the kasa for a type that is not a cash movement', 'LABOR_COST', '5', '5', ''],
    ['keeps the pick when the new type carries a kasa', 'INVESTMENT_EXPENSE', '5', '9', '5'],
    [
      "refills from the user's default once the field is empty again",
      'INVESTMENT_EXPENSE',
      '',
      '9',
      '9',
    ],
    ['stays empty when the user has no default kasa', 'INVESTMENT_EXPENSE', '', '', ''],
  ])('%s', (_case, type, picked, userDefault, expected) => {
    expect(sourceRegisterForType(type, picked, userDefault)).toBe(expected)
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

  it('keeps the kasa when both types carry one', () => {
    expect(patch('CORRECTION')).not.toHaveProperty('sourceRegister')
  })

  it('keeps the settled flag between two settleable types', () => {
    expect(patch('CORRECTION')).not.toHaveProperty('settled')
  })
})
