import { describe, it, expect } from 'vitest'
import {
  TRANSFER_TYPES,
  TRANSACTION_TRANSFER_TYPES,
  DEPOSIT_TYPES,
  isDepositType,
  needsSourceRegister,
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
    trueFor: ['INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT'],
  },
  needsSourceRegister: {
    fn: needsSourceRegister,
    // true for everything EXCEPT EMPLOYEE_EXPENSE
    trueFor: TRANSFER_TYPES.filter((t) => t !== 'EMPLOYEE_EXPENSE') as string[],
  },
  showsInvestment: {
    fn: showsInvestment,
    trueFor: ['INVESTOR_DEPOSIT', 'INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE'],
  },
  requiresInvestment: {
    fn: requiresInvestment,
    trueFor: ['INVESTOR_DEPOSIT', 'INVESTMENT_EXPENSE'],
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

describe('TRANSACTION_TRANSFER_TYPES', () => {
  it('contains exactly the expected types', () => {
    expect(TRANSACTION_TRANSFER_TYPES).toEqual([
      'OTHER',
      'INVESTMENT_EXPENSE',
      'PAYOUT',
      'ACCOUNT_FUNDING',
    ])
  })

  it('excludes all deposit types', () => {
    for (const depositType of DEPOSIT_TYPES) {
      expect(TRANSACTION_TRANSFER_TYPES).not.toContain(depositType)
    }
  })

  it('excludes REGISTER_TRANSFER', () => {
    expect(TRANSACTION_TRANSFER_TYPES).not.toContain('REGISTER_TRANSFER')
  })

  it('excludes EMPLOYEE_EXPENSE', () => {
    expect(TRANSACTION_TRANSFER_TYPES).not.toContain('EMPLOYEE_EXPENSE')
  })

  it('every entry is a valid TransferTypeT', () => {
    for (const t of TRANSACTION_TRANSFER_TYPES) {
      expect(TRANSFER_TYPES).toContain(t)
    }
  })
})

describe('transfer constants — edge cases', () => {
  const allHelpers: [string, HelperFn][] = Object.entries(HELPERS).map(([name, h]) => [name, h.fn])

  for (const [name, fn] of allHelpers) {
    // needsSourceRegister uses `!== 'EMPLOYEE_EXPENSE'`, so unknown types return true
    const expectedForUnknown = name === 'needsSourceRegister'

    it(`${name}('') → ${expectedForUnknown}`, () => {
      expect(fn('')).toBe(expectedForUnknown)
    })

    it(`${name}('UNKNOWN_TYPE') → ${expectedForUnknown}`, () => {
      expect(fn('UNKNOWN_TYPE')).toBe(expectedForUnknown)
    })
  }
})
