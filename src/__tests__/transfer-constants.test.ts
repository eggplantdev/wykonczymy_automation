import { describe, it, expect } from 'vitest'
import {
  TRANSFER_TYPES,
  TRANSACTION_TRANSFER_TYPES,
  DEPOSIT_TYPES,
  isTransferType,
  isDepositType,
  needsSourceRegister,
  showsInvestment,
  requiresInvestment,
  needsTargetRegister,
  needsOtherCategory,
  needsExpenseCategory,
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
    // true for everything EXCEPT LABOR_COST, RABAT and LOSS (P&L figures, no cash movement)
    trueFor: TRANSFER_TYPES.filter(
      (t) => t !== 'LABOR_COST' && t !== 'RABAT' && t !== 'LOSS',
    ) as string[],
  },
  showsInvestment: {
    fn: showsInvestment,
    trueFor: [
      'INVESTOR_DEPOSIT',
      'INVESTMENT_EXPENSE',
      'LABOR_COST',
      'COMPANY_FUNDING',
      'OTHER_DEPOSIT',
      'CORRECTION',
      'PAYOUT',
      'RABAT',
      'LOSS',
    ],
  },
  requiresInvestment: {
    fn: requiresInvestment,
    trueFor: ['INVESTOR_DEPOSIT', 'INVESTMENT_EXPENSE', 'LABOR_COST', 'RABAT'],
  },
  needsTargetRegister: {
    fn: needsTargetRegister,
    trueFor: ['REGISTER_TRANSFER'],
  },
  needsOtherCategory: {
    fn: needsOtherCategory,
    trueFor: ['OTHER'],
  },
  needsExpenseCategory: {
    fn: needsExpenseCategory,
    trueFor: ['INVESTMENT_EXPENSE'],
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
      'CORRECTION',
      'LABOR_COST',
      'RABAT',
      'LOSS',
      'INVESTMENT_EXPENSE',
      'PAYOUT',
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

  it('excludes ACCOUNT_FUNDING', () => {
    expect(TRANSACTION_TRANSFER_TYPES).not.toContain('ACCOUNT_FUNDING')
  })

  it('every entry is a valid TransferTypeT', () => {
    for (const t of TRANSACTION_TRANSFER_TYPES) {
      expect(TRANSFER_TYPES).toContain(t)
    }
  })
})

describe('isTransferType — type guard', () => {
  it('returns true for all valid transfer types', () => {
    for (const type of TRANSFER_TYPES) {
      expect(isTransferType(type)).toBe(true)
    }
  })

  it('returns false for empty string', () => {
    expect(isTransferType('')).toBe(false)
  })

  it('returns false for unknown type', () => {
    expect(isTransferType('UNKNOWN_TYPE')).toBe(false)
  })
})

describe('transfer constants — edge cases', () => {
  const allHelpers: [string, HelperFn][] = Object.entries(HELPERS).map(([name, h]) => [name, h.fn])

  for (const [name, fn] of allHelpers) {
    it(`${name}('') → false`, () => {
      expect(fn('')).toBe(false)
    })

    it(`${name}('UNKNOWN_TYPE') → false`, () => {
      expect(fn('UNKNOWN_TYPE')).toBe(false)
    })
  }
})
