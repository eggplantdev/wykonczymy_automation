import { describe, it, expect } from 'vitest'
import {
  TRANSFER_TYPES,
  isDepositType,
  needsCashRegister,
  showsInvestment,
  requiresInvestment,
  needsWorker,
  needsTargetRegister,
  needsOtherCategory,
} from '@/lib/constants/transfers'

// ── Truth table: expected return value per (helper × type) ──────────────

type HelperFn = (type: string) => boolean

const HELPERS: Record<string, { fn: HelperFn; trueFor: string[] }> = {
  isDepositType: {
    fn: isDepositType,
    trueFor: ['INVESTOR_DEPOSIT', 'STAGE_SETTLEMENT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT'],
  },
  needsCashRegister: {
    fn: needsCashRegister,
    // true for everything EXCEPT EMPLOYEE_EXPENSE
    trueFor: TRANSFER_TYPES.filter((t) => t !== 'EMPLOYEE_EXPENSE') as string[],
  },
  showsInvestment: {
    fn: showsInvestment,
    trueFor: ['INVESTOR_DEPOSIT', 'STAGE_SETTLEMENT', 'INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE'],
  },
  requiresInvestment: {
    fn: requiresInvestment,
    trueFor: ['INVESTOR_DEPOSIT', 'STAGE_SETTLEMENT', 'INVESTMENT_EXPENSE'],
  },
  needsWorker: {
    fn: needsWorker,
    trueFor: ['ACCOUNT_FUNDING', 'EMPLOYEE_EXPENSE'],
  },
  needsTargetRegister: {
    fn: needsTargetRegister,
    trueFor: ['REGISTER_TRANSFER'],
  },
  needsOtherCategory: {
    fn: needsOtherCategory,
    trueFor: ['OTHER', 'EMPLOYEE_EXPENSE'],
  },
}

describe('transfer constants — helper truth table', () => {
  for (const [helperName, { fn, trueFor }] of Object.entries(HELPERS)) {
    describe(helperName, () => {
      for (const type of TRANSFER_TYPES) {
        const expected = trueFor.includes(type)
        it(`${type} → ${expected}`, () => {
          expect(fn(type)).toBe(expected)
        })
      }
    })
  }
})

describe('transfer constants — edge cases', () => {
  const allHelpers: [string, HelperFn][] = Object.entries(HELPERS).map(([name, h]) => [name, h.fn])

  for (const [name, fn] of allHelpers) {
    // needsCashRegister uses `!== 'EMPLOYEE_EXPENSE'`, so unknown types return true
    const expectedForUnknown = name === 'needsCashRegister'

    it(`${name}('') → ${expectedForUnknown}`, () => {
      expect(fn('')).toBe(expectedForUnknown)
    })

    it(`${name}('UNKNOWN_TYPE') → ${expectedForUnknown}`, () => {
      expect(fn('UNKNOWN_TYPE')).toBe(expectedForUnknown)
    })
  }
})
