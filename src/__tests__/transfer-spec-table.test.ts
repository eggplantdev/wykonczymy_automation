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

// The spec table makes a MISSING decision a compile error. It cannot make a WRONG one —
// nor can it stop a retained literal array from drifting away from the column it mirrors.
// That is this file's job, and it is a deliberate trade (see plan.md, decision 1): the
// arrays that stay literal do so because deriving them would destroy a literal union,
// break an eager module-load read, or silently rewrite a live client spreadsheet.

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
    // net_amount is written for the netto expense alone. A type that billed at netAmount
    // from any other bucket would sum a column its rows leave NULL — a silent zero.
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
    // Containment, not equality: the dialog array is sorted by Polish label and further
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
    // The summary block is a FIXED sheet column layout (I–N), rebuilt verbatim by
    // setupTab on a reset/relink. CORRECTION keeps its 5th slot with a SUMIF that totals
    // 0, because dropping the column would shift LOSS left and break formulas keyed to a
    // fixed position. So this array must NOT equal the transfersSheetTab column.
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
  // Before the table, deriveFinancials read DEPOSIT_TYPES and isExpensesTabType directly —
  // it bucketed money by where a row is MIRRORED ON THE SHEET. Phase 2 gave the money its
  // own column, so those two questions can now be answered differently. They agree today,
  // and these two pins are what make a future disagreement a deliberate edit rather than
  // a figure that silently moved.
  it('the income bucket is exactly the deposit column', () => {
    expect(sorted(typesWhere((s) => s.financialBucket === 'income'))).toEqual(
      sorted(typesWhere((s) => s.deposit)),
    )
  })

  it('the two materials buckets together are exactly the expenses-tab column', () => {
    // The netto expense split materials in two — the brutto base the global kosztorys
    // toggle may still deduct, and the frozen netto figure it must never reach. Both
    // mirror to the expenses tab, so the union is what the column equals.
    expect(
      sorted(
        typesWhere(
          (s) => s.financialBucket === 'materials' || s.financialBucket === 'materialsNet',
        ),
      ),
    ).toEqual(sorted(typesWhere((s) => s.expensesSheetTab)))
  })

  it('only a materials type is settleable — the settled split has no other home', () => {
    // deriveFinancials splits ONLY the brutto materials bucket on `settled`. A settleable
    // type outside it would carry a flag nothing reads — and `materialsNet` is excluded
    // on purpose: settled routes into totalSettled, which marża reads.
    for (const type of typesWhere((s) => s.settleable)) {
      expect(TRANSFER_TYPE_SPECS[type].financialBucket, type).toBe('materials')
    }
  })
})

describe('settleable vs expensesSheetTab — the split the table exists for', () => {
  it('a settleable type always owns an expenses-tab row', () => {
    // This direction IS a rule, not a coincidence: the settled flag means "material
    // priced into robocizna", which only makes sense for a material expense. The reverse
    // is what INVESTMENT_EXPENSE_NET broke — it mirrors to the expenses tab and is not
    // settleable, so the two columns no longer coincide.
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
