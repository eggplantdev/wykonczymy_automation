import { describe, it, expect } from 'vitest'
import {
  TRANSFER_TYPES,
  TRANSFER_TYPE_SPECS,
  DEPOSIT_TYPES,
  DEPOSIT_UI_TYPES,
  TRANSACTION_TRANSFER_TYPES,
  EXPENSES_TAB_TYPES,
  SHEET_TRANSFER_TAB_TYPES,
  TRANSFERS_SUMMARY_TYPES,
  type TransferTypeT,
} from '@/lib/constants/transfers'

const typesWhere = (predicate: (spec: (typeof TRANSFER_TYPE_SPECS)[TransferTypeT]) => boolean) =>
  TRANSFER_TYPES.filter((type) => predicate(TRANSFER_TYPE_SPECS[type]))

const sorted = (types: readonly string[]) => [...types].sort()

describe('spec table — structural integrity', () => {
  it('has exactly one row per transfer type, and no extras', () => {
    expect(sorted(Object.keys(TRANSFER_TYPE_SPECS))).toEqual(sorted(TRANSFER_TYPES))
  })

  it('every row answers every column', () => {
    const columns = [
      'label',
      'color',
      'deposit',
      'expensesSheetTab',
      'transfersSheetTab',
      'settleable',
      'financialBucket',
      'billedAmount',
      'sourceRegister',
    ]
    for (const type of TRANSFER_TYPES) {
      expect(sorted(Object.keys(TRANSFER_TYPE_SPECS[type])), type).toEqual(sorted(columns))
    }
  })

  it('financialBucket is one of the allowed buckets', () => {
    const buckets = [
      'materials',
      'materialsNet',
      'income',
      'laborCosts',
      'payouts',
      'discount',
      'loss',
      'bonus',
      'none',
    ]
    for (const type of TRANSFER_TYPES) {
      expect(buckets, type).toContain(TRANSFER_TYPE_SPECS[type].financialBucket)
    }
  })

  it('billedAmount is one of the two stored columns', () => {
    for (const type of TRANSFER_TYPES) {
      expect(['amount', 'netAmount'], type).toContain(TRANSFER_TYPE_SPECS[type].billedAmount)
    }
  })

  it('only a materialsNet type bills at netAmount', () => {
    // A type that billed at netAmount
    for (const type of typesWhere((s) => s.billedAmount === 'netAmount')) {
      expect(TRANSFER_TYPE_SPECS[type].financialBucket, type).toBe('materialsNet')
    }
  })

  it('sourceRegister is one of the two allowed states', () => {
    for (const type of TRANSFER_TYPES) {
      expect(['required', 'never'], type).toContain(TRANSFER_TYPE_SPECS[type].sourceRegister)
    }
  })
})

describe('literal arrays agree with the table', () => {
  it('DEPOSIT_TYPES === deposit column', () => {
    expect(sorted(DEPOSIT_TYPES)).toEqual(sorted(typesWhere((s) => s.deposit)))
  })

  it('EXPENSES_TAB_TYPES === expensesSheetTab column', () => {
    expect(sorted(EXPENSES_TAB_TYPES)).toEqual(sorted(typesWhere((s) => s.expensesSheetTab)))
  })

  it('SHEET_TRANSFER_TAB_TYPES === transfersSheetTab column', () => {
    expect(sorted(SHEET_TRANSFER_TAB_TYPES)).toEqual(sorted(typesWhere((s) => s.transfersSheetTab)))
  })

  it('DEPOSIT_UI_TYPES is a subset of the deposit column', () => {
    // the dialog array is sorted by Polish label and further
    // role-filtered at render, so its order and length are free to differ from the column.
    for (const type of DEPOSIT_UI_TYPES) {
      expect(TRANSFER_TYPE_SPECS[type].deposit, type).toBe(true)
    }
  })

  it('TRANSACTION_TRANSFER_TYPES contains no deposit type', () => {
    for (const type of TRANSACTION_TRANSFER_TYPES) {
      expect(TRANSFER_TYPE_SPECS[type].deposit, type).toBe(false)
    }
  })

  it('TRANSFERS_SUMMARY_TYPES is decoupled from routing — CORRECTION is the proof', () => {
    // CORRECTION keeps its 5th slot with a SUMIF that totals
    // 0, because dropping the column would shift LOSS left and break formulas keyed to a fixed position.
    expect(TRANSFERS_SUMMARY_TYPES).toContain('CORRECTION')
    expect(TRANSFER_TYPE_SPECS.CORRECTION.transfersSheetTab).toBe(false)
  })
})

describe('sheet-sync inputs are eager at module load', () => {
  // sync-sheet.ts spreads these two arrays into SHEET_SYNCED_TYPES at module load, inside
  // the Payload config graph. If either ever became a lazy or derived value that evaluates
  // to [] there, the spread would silently produce an empty list and EVERY transfer would
  // stop syncing to the sheet — with no error anywhere.
  it.each([
    ['EXPENSES_TAB_TYPES', EXPENSES_TAB_TYPES],
    ['SHEET_TRANSFER_TAB_TYPES', SHEET_TRANSFER_TAB_TYPES],
  ])('%s is non-empty on import', (_name, array) => {
    expect(array.length).toBeGreaterThan(0)
  })
})

describe('financialBucket vs the routing columns', () => {
  it('the income bucket is exactly the deposit column', () => {
    expect(sorted(typesWhere((s) => s.financialBucket === 'income'))).toEqual(
      sorted(typesWhere((s) => s.deposit)),
    )
  })

  it('the two materials buckets together are exactly the expenses-tab column', () => {
    expect(
      sorted(
        typesWhere(
          (s) => s.financialBucket === 'materials' || s.financialBucket === 'materialsNet',
        ),
      ),
    ).toEqual(sorted(typesWhere((s) => s.expensesSheetTab)))
  })

  it('only a materials type is settleable — the settled split has no other home', () => {
    for (const type of typesWhere((s) => s.settleable)) {
      expect(TRANSFER_TYPE_SPECS[type].financialBucket, type).toBe('materials')
    }
  })
})

describe('settleable vs expensesSheetTab — the split the table exists for', () => {
  it('a settleable type always owns an expenses-tab row', () => {
    for (const type of typesWhere((s) => s.settleable)) {
      expect(TRANSFER_TYPE_SPECS[type].expensesSheetTab, type).toBe(true)
    }
  })

  it('the netto expense is the one expenses-tab type that is not settleable', () => {
    expect(sorted(typesWhere((s) => s.expensesSheetTab && !s.settleable))).toEqual([
      'INVESTMENT_EXPENSE_NET',
    ])
  })
})
