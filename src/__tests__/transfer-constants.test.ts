import { describe, it, expect } from 'vitest'
import * as transfersModule from '@/lib/constants/transfers'
import {
  TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  TRANSFER_TYPE_COLORS,
  TRANSACTION_TRANSFER_TYPES,
  DEPOSIT_TYPES,
  DEPOSIT_UI_TYPES,
  EXPENSES_TAB_TYPES,
  SHEET_TRANSFER_TAB_TYPES,
  TRANSFERS_SUMMARY_TYPES,
  isTransferType,
  isDepositType,
  needsSourceRegister,
  showsInvestment,
  requiresInvestment,
  needsTargetRegister,
  needsWorker,
  hasOptionalWorker,
  showsWorker,
  needsOtherCategory,
  showsOtherCategory,
  needsExpenseCategory,
  isSheetTransferTabType,
  isExpensesTabType,
  billsNetAmount,
  canBeSettled,
  carriesNetAmount,
  carriesVatPlane,
  carriesPaymentMethod,
  carriesPayoutStatus,
  canFillVatPlane,
  isInvestmentExpense,
  isLaborCost,
  isCancellationType,
  planeFor,
  isVatPlane,
  VAT_PLANES,
} from '@/lib/constants/transfers'

// these expectations are written
// as hand-typed literals — never derived from the same arrays they guard, which would
// make them tautologically green.

type HelperFn = (type: string) => boolean

const HELPERS: Record<string, { fn: HelperFn; trueFor: string[] }> = {
  isTransferType: {
    fn: isTransferType,
    trueFor: [...TRANSFER_TYPES],
  },
  isDepositType: {
    fn: isDepositType,
    trueFor: ['INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT'],
  },
  needsSourceRegister: {
    fn: needsSourceRegister,
    trueFor: [
      'OTHER_DEPOSIT',
      'OTHER',
      'CORRECTION',
      'REGISTER_TRANSFER',
      'INVESTOR_DEPOSIT',
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'PAYOUT',
      'COMPANY_FUNDING',
    ],
  },
  showsInvestment: {
    fn: showsInvestment,
    trueFor: [
      'INVESTOR_DEPOSIT',
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'LABOR_COST',
      'CORRECTION',
      'PAYOUT',
      'RABAT',
      'LOSS',
      'BONUS',
    ],
  },
  requiresInvestment: {
    fn: requiresInvestment,
    trueFor: [
      'INVESTOR_DEPOSIT',
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'LABOR_COST',
      'RABAT',
      'LOSS',
      'BONUS',
    ],
  },
  needsTargetRegister: {
    fn: needsTargetRegister,
    trueFor: ['REGISTER_TRANSFER'],
  },
  needsWorker: {
    fn: needsWorker,
    trueFor: ['PAYOUT', 'BONUS'],
  },
  hasOptionalWorker: {
    fn: hasOptionalWorker,
    trueFor: ['OTHER'],
  },
  showsWorker: {
    fn: showsWorker,
    trueFor: ['PAYOUT', 'BONUS', 'OTHER'],
  },
  needsOtherCategory: {
    fn: needsOtherCategory,
    trueFor: ['OTHER'],
  },
  showsOtherCategory: {
    fn: showsOtherCategory,
    trueFor: ['OTHER', 'INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET', 'PAYOUT'],
  },
  needsExpenseCategory: {
    fn: needsExpenseCategory,
    trueFor: ['INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET'],
  },
  isSheetTransferTabType: {
    fn: isSheetTransferTabType,
    trueFor: ['INVESTOR_DEPOSIT', 'LABOR_COST', 'RABAT', 'PAYOUT', 'LOSS'],
  },
  isExpensesTabType: {
    fn: isExpensesTabType,
    trueFor: ['INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET', 'CORRECTION'],
  },
  billsNetAmount: {
    fn: billsNetAmount,
    trueFor: ['INVESTMENT_EXPENSE_NET'],
  },
  canBeSettled: {
    fn: canBeSettled,
    // No INVESTMENT_EXPENSE_NET: „wliczone w robociznę" routes an amount into
    // totalSettled, which marża reads — the netto figure must never reach it.
    trueFor: ['INVESTMENT_EXPENSE', 'CORRECTION'],
  },
  isLaborCost: {
    fn: isLaborCost,
    trueFor: ['LABOR_COST'],
  },
  isCancellationType: {
    fn: isCancellationType,
    trueFor: ['CANCELLATION'],
  },
  carriesVatPlane: {
    fn: carriesVatPlane,
    trueFor: ['INVESTOR_DEPOSIT'],
  },
  carriesPaymentMethod: {
    fn: carriesPaymentMethod,
    trueFor: ['INVESTOR_DEPOSIT', 'INVESTMENT_EXPENSE_NET'],
  },
  carriesPayoutStatus: {
    fn: carriesPayoutStatus,
    trueFor: ['PAYOUT'],
  },
  isInvestmentExpense: {
    fn: isInvestmentExpense,
    trueFor: ['INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET'],
  },
}

const NOT_A_TRANSFER_TYPE_PREDICATE = [
  'transferColorVar',
  'financialBucketOf',
  'billedAmountOf',
  'billedAmountFor',
  'isVatPlane',
  'carriesNetAmount',
  'planeFor',
  'canFillVatPlane',
]

describe('transfer constants — helper truth table', () => {
  it('covers every exported predicate', () => {
    const covered = [...Object.keys(HELPERS), ...NOT_A_TRANSFER_TYPE_PREDICATE]
    const exported = Object.entries(transfersModule)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name)
    expect(covered.sort()).toEqual(exported.sort())
  })

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

describe('needsSourceRegister — CANCELLATION', () => {
  it('is false — a cancellation gets no register picker', () => {
    expect(needsSourceRegister('CANCELLATION')).toBe(false)
  })
})

describe('canBeSettled vs isExpensesTabType — the equality that ended', () => {
  it('INVESTMENT_EXPENSE_NET is the counterexample', () => {
    expect(isExpensesTabType('INVESTMENT_EXPENSE_NET')).toBe(true)
    expect(canBeSettled('INVESTMENT_EXPENSE_NET')).toBe(false)
  })

  it('settleable still implies an expenses-tab row — that direction IS a rule', () => {
    for (const type of TRANSFER_TYPES) {
      if (canBeSettled(type)) expect(isExpensesTabType(type), type).toBe(true)
    }
  })
})

describe('needsExpenseCategory — investment-aware', () => {
  it.each([
    ['INVESTMENT_EXPENSE', undefined, true],
    ['INVESTMENT_EXPENSE', false, true],
    ['INVESTMENT_EXPENSE', true, true],
    ['CORRECTION', true, true],
    ['CORRECTION', false, false],
    ['CORRECTION', undefined, false],
    ['LOSS', true, false],
    ['OTHER', true, false],
    ['', true, false],
    ['UNKNOWN_TYPE', true, false],
  ] as const)('needsExpenseCategory(%s, %s) === %s', (type, hasInvestment, expected) => {
    expect(needsExpenseCategory(type, hasInvestment)).toBe(expected)
  })
})

describe('membership arrays — exact contents and order', () => {
  it('TRANSFER_TYPES', () => {
    expect(TRANSFER_TYPES).toEqual([
      'CANCELLATION',
      'OTHER_DEPOSIT',
      'OTHER',
      'CORRECTION',
      'LABOR_COST',
      'BONUS',
      'RABAT',
      'LOSS',
      'REGISTER_TRANSFER',
      'INVESTOR_DEPOSIT',
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'PAYOUT',
      'COMPANY_FUNDING',
    ])
  })

  it('DEPOSIT_TYPES', () => {
    expect(DEPOSIT_TYPES).toEqual(['INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT'])
  })

  it('DEPOSIT_UI_TYPES', () => {
    expect(DEPOSIT_UI_TYPES).toEqual(['OTHER_DEPOSIT', 'INVESTOR_DEPOSIT', 'COMPANY_FUNDING'])
  })

  it('TRANSACTION_TRANSFER_TYPES', () => {
    expect(TRANSACTION_TRANSFER_TYPES).toEqual([
      'OTHER',
      'CORRECTION',
      'LABOR_COST',
      'BONUS',
      'RABAT',
      'LOSS',
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'PAYOUT',
    ])
  })

  it('EXPENSES_TAB_TYPES', () => {
    expect(EXPENSES_TAB_TYPES).toEqual([
      'INVESTMENT_EXPENSE',
      'INVESTMENT_EXPENSE_NET',
      'CORRECTION',
    ])
  })

  it('SHEET_TRANSFER_TAB_TYPES', () => {
    expect(SHEET_TRANSFER_TAB_TYPES).toEqual([
      'INVESTOR_DEPOSIT',
      'LABOR_COST',
      'RABAT',
      'PAYOUT',
      'LOSS',
    ])
  })

  // A reorder here silently rewrites live client
  // spreadsheets, with no failure preceding the damage.
  it('TRANSFERS_SUMMARY_TYPES — order is a live sheet column layout', () => {
    expect(TRANSFERS_SUMMARY_TYPES).toEqual([
      'INVESTOR_DEPOSIT',
      'LABOR_COST',
      'RABAT',
      'PAYOUT',
      'CORRECTION',
      'LOSS',
    ])
  })

  it('TRANSACTION_TRANSFER_TYPES excludes deposits and REGISTER_TRANSFER', () => {
    for (const depositType of DEPOSIT_TYPES) {
      expect(TRANSACTION_TRANSFER_TYPES).not.toContain(depositType)
    }
    expect(TRANSACTION_TRANSFER_TYPES).not.toContain('REGISTER_TRANSFER')
  })

  it('every array entry is a valid TransferTypeT', () => {
    const arrays = {
      DEPOSIT_TYPES,
      DEPOSIT_UI_TYPES,
      TRANSACTION_TRANSFER_TYPES,
      EXPENSES_TAB_TYPES,
      SHEET_TRANSFER_TAB_TYPES,
      TRANSFERS_SUMMARY_TYPES,
    }
    for (const [name, arr] of Object.entries(arrays)) {
      for (const t of arr) {
        expect(TRANSFER_TYPES, `${name} contains unknown type ${t}`).toContain(t)
      }
    }
  })
})

describe('TRANSFER_TYPE_LABELS / TRANSFER_TYPE_COLORS', () => {
  it.each([
    ['CANCELLATION', 'Anulowanie', 'muted-foreground'],
    ['OTHER_DEPOSIT', 'Inna wpłata', 'section-teal'],
    ['OTHER', 'Inny wydatek', 'transfer-red-warm'],
    ['CORRECTION', 'Korekta', 'section-orange'],
    ['LABOR_COST', 'Koszty robocizny', 'section-orange-deep'],
    ['BONUS', 'Premia', 'section-yellow'],
    ['RABAT', 'Rabat', 'section-yellow-deep'],
    ['LOSS', 'Strata', 'section-purple'],
    ['REGISTER_TRANSFER', 'Transfer między kasami', 'section-turquoise'],
    ['INVESTOR_DEPOSIT', 'Wpłata od inwestora', 'section-green'],
    ['INVESTMENT_EXPENSE', 'Wydatek inwestycyjny', 'section-red'],
    ['INVESTMENT_EXPENSE_NET', 'Wydatek inwestycyjny netto', 'transfer-red-dark'],
    ['PAYOUT', 'Wypłata', 'section-red-deep'],
    ['COMPANY_FUNDING', 'Zasilenie z konta firmowego', 'section-green-deep'],
  ] as const)('%s → %s / %s', (type, label, color) => {
    expect(TRANSFER_TYPE_LABELS[type]).toBe(label)
    expect(TRANSFER_TYPE_COLORS[type]).toBe(color)
  })

  it('TRANSFER_TYPES is sorted by its Polish label', () => {
    const labels = TRANSFER_TYPES.map((t) => TRANSFER_TYPE_LABELS[t])
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'pl')))
  })
})

describe('every predicate returns false for unknown input', () => {
  for (const [name, { fn }] of Object.entries(HELPERS)) {
    it.each(['', 'UNKNOWN_TYPE', 'investment_expense'])(`${name}(%j) → false`, (input) => {
      expect(fn(input)).toBe(false)
    })
  }
})

describe('unknown-tolerant predicates reject non-string input', () => {
  const unknownTolerant: [string, (t: unknown) => boolean][] = [
    ['isSheetTransferTabType', isSheetTransferTabType],
    ['isExpensesTabType', isExpensesTabType],
    ['canBeSettled', canBeSettled],
  ]
  for (const [name, fn] of unknownTolerant) {
    it.each([null, undefined, 0, {}, []])(`${name}(%j) → false`, (input) => {
      expect(fn(input)).toBe(false)
    })
  }
})

describe('carriesNetAmount — keyed on the pair, not the type', () => {
  it.each([
    ['INVESTMENT_EXPENSE_NET', 'NET', true],
    ['INVESTMENT_EXPENSE_NET', 'GROSS', true],
    ['INVESTMENT_EXPENSE_NET', undefined, true],
    ['INVESTOR_DEPOSIT', 'GROSS', true],
    ['INVESTOR_DEPOSIT', 'NET', false],
    ['INVESTOR_DEPOSIT', undefined, false],
    ['INVESTMENT_EXPENSE', 'GROSS', false],
    ['COMPANY_FUNDING', 'GROSS', false],
    ['OTHER_DEPOSIT', 'GROSS', false],
  ] as const)('carriesNetAmount(%s, %s) === %s', (type, plane, expected) => {
    expect(carriesNetAmount(type, plane)).toBe(expected)
  })
})

describe('planeFor — the method names the plane, on the deposit type alone', () => {
  it.each([
    ['INVESTOR_DEPOSIT', 'TRANSFER', 'GROSS'],
    ['INVESTOR_DEPOSIT', 'CASH', 'NET'],
    ['INVESTMENT_EXPENSE', 'TRANSFER', 'NET'],
    ['COMPANY_FUNDING', 'TRANSFER', 'NET'],
    ['INVESTOR_DEPOSIT', undefined, 'NET'],
  ] as const)('planeFor(%s, %s) === %s', (type, method, expected) => {
    expect(planeFor(type, method)).toBe(expected)
  })
})

describe('canFillVatPlane — only a wpłata that never had a plane', () => {
  it.each([
    [{ type: 'INVESTOR_DEPOSIT', vatPlane: null }, true],
    [{ type: 'INVESTOR_DEPOSIT', vatPlane: undefined }, true],
    [{ type: 'INVESTOR_DEPOSIT', vatPlane: 'NET' }, false],
    [{ type: 'INVESTOR_DEPOSIT', vatPlane: 'GROSS' }, false],
    [{ type: 'INVESTMENT_EXPENSE', vatPlane: null }, false],
    [{ type: 'COMPANY_FUNDING', vatPlane: null }, false],
  ] as const)('%o → %s', (row, expected) => {
    expect(canFillVatPlane(row)).toBe(expected)
  })
})

describe('isVatPlane', () => {
  it.each(VAT_PLANES)('%s → true', (plane) => {
    expect(isVatPlane(plane)).toBe(true)
  })

  it.each(['', 'net', 'BRUTTO', undefined])('%j → false', (input) => {
    expect(isVatPlane(input)).toBe(false)
  })
})
