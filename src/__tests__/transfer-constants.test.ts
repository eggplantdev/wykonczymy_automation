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
  canFillVatPlane,
  isLaborCost,
  isCancellationType,
  planeFor,
  isVatPlane,
  VAT_PLANES,
} from '@/lib/constants/transfers'

// CHARACTERIZATION SUITE (EX-573 phase 0). Everything here is pinned against the
// implementation as it stands BEFORE the spec-table rewrite. A test authored after the
// rewrite proves nothing about behaviour preservation, so these expectations are written
// as hand-typed literals — never derived from the same arrays they guard, which would
// make them tautologically green.

type HelperFn = (type: string) => boolean

// ── Truth table: every predicate × every type ───────────────────────────

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
    // Everything except the three P&L figures with no cash movement, plus CANCELLATION.
    // CANCELLATION was in this list until EX-573 phase 3 — a DELIBERATE behaviour change,
    // not a drift: a cancellation annotates the row it reverses and moves no cash of its
    // own, so offering it a „Kasa" picker only opened a path to draining that register.
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
    // The tag names which side of the settlement a wpłata pays, so only a wpłata od inwestora
    // has one — every other type stores null and validate.ts strips a smuggled plane.
    trueFor: ['INVESTOR_DEPOSIT'],
  },
  carriesPaymentMethod: {
    fn: carriesPaymentMethod,
    trueFor: ['INVESTOR_DEPOSIT', 'INVESTMENT_EXPENSE_NET'],
  },
}

// No row in the truth table above, which is keyed on transfer type. The first three are
// not boolean — their per-type answers are pinned by the spec-table consistency suite
// instead (transfer-spec-table.test.ts). `isVatPlane` is boolean but narrows a VAT plane,
// not a transfer type, so it gets its own suite below; `carriesNetAmount` and `planeFor` are
// keyed on a PAIR the truth table above has no column for, so they too get their own.
// `transferColorVar` returns a CSS colour, not a boolean.
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
    // Derived from the module, not a hand-typed count — a `toHaveLength(15)` stays green
    // forever while a newly exported predicate goes untested. Its one exclusion is named
    // and justified, so adding an export forces a decision here rather than silence.
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
  // Flipped from true in EX-573 phase 3. A cancellation is an audit stub with no cash
  // movement of its own — the register was already moved by the row being reversed. While
  // this was true, the admin panel offered a cancellation a „Kasa" picker whose value
  // nothing cleared (validate.ts returns early for CANCELLATION) and which would land in
  // the `ELSE -amount` arm of sum-transfers.ts, silently draining that register.
  //
  // Defence, not repair: 0 of the 257 cancellations in the production dataset carry a
  // register, which is why the golden master's 29 register balances are unmoved by this.
  it('is false — a cancellation gets no register picker', () => {
    expect(needsSourceRegister('CANCELLATION')).toBe(false)
  })
})

describe('canBeSettled vs isExpensesTabType — the equality that ended', () => {
  // The two agreed for all 12 pre-netto types, which is why they were once a single
  // predicate. That was a coincidence of the type set, not a rule, and
  // INVESTMENT_EXPENSE_NET broke it: an expenses-tab row that must NOT be settleable.
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

// ── Exact contents AND order of every membership array ──────────────────

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
    // LABOR_COST and RABAT are back (EX-649) and leave again under EX-712. Reading both figures off
    // the kosztorys only works once the kosztorys is IN the app; while it is still a spreadsheet the
    // dialog was the only way to settle the investment at all.
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

  // Order IS the sheet's summary-block column layout (I–N), rewritten verbatim by
  // setupTab on a reset/relink. A reorder here silently rewrites live client
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

// ── Label and colour maps ───────────────────────────────────────────────

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

// ── Unknown input ───────────────────────────────────────────────────────

describe('every predicate returns false for unknown input', () => {
  for (const [name, { fn }] of Object.entries(HELPERS)) {
    it.each(['', 'UNKNOWN_TYPE', 'investment_expense'])(`${name}(%j) → false`, (input) => {
      expect(fn(input)).toBe(false)
    })
  }
})

describe('unknown-tolerant predicates reject non-string input', () => {
  // These three take `unknown` (collections/transfers.ts:250 relies on it) — the rest
  // take `string`. Pinned so the rewrite can't quietly narrow the signature.
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
  // Two unrelated reasons behind one predicate, and only one of them reads the plane: a netto
  // wydatek carries a netto whatever the plane says, a wpłata only when it arrived as a przelew.
  it.each([
    ['INVESTMENT_EXPENSE_NET', 'NET', true],
    ['INVESTMENT_EXPENSE_NET', 'GROSS', true],
    ['INVESTMENT_EXPENSE_NET', undefined, true],
    ['INVESTOR_DEPOSIT', 'GROSS', true],
    ['INVESTOR_DEPOSIT', 'NET', false],
    // Untagged is gotówka: one kwota netto, no brutto twin to name.
    ['INVESTOR_DEPOSIT', undefined, false],
    ['INVESTMENT_EXPENSE', 'GROSS', false],
    ['COMPANY_FUNDING', 'GROSS', false],
    ['OTHER_DEPOSIT', 'GROSS', false],
  ] as const)('carriesNetAmount(%s, %s) === %s', (type, plane, expected) => {
    expect(carriesNetAmount(type, plane)).toBe(expected)
  })
})

// The method IS the plane, and both forms that name one read it here — the wpłata form when
// booking, the edit form when filling in a legacy row — so a fork between the two is impossible.
describe('planeFor — the method names the plane, on the deposit type alone', () => {
  it.each([
    ['INVESTOR_DEPOSIT', 'TRANSFER', 'GROSS'],
    ['INVESTOR_DEPOSIT', 'CASH', 'NET'],
    // A przelew on any other type is only the tor it travelled: one kwota, and no brutto field on
    // screen for a GROSS tag to name.
    ['INVESTMENT_EXPENSE', 'TRANSFER', 'NET'],
    ['COMPANY_FUNDING', 'TRANSFER', 'NET'],
    ['INVESTOR_DEPOSIT', undefined, 'NET'],
  ] as const)('planeFor(%s, %s) === %s', (type, method, expected) => {
    expect(planeFor(type, method)).toBe(expected)
  })
})

// The predicate the whole fill-in turns on, named once so the form that offers the question, the
// payload that carries the answer and the action that lets it through cannot drift apart.
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

  // undefined is the stored state of every wpłata booked before EX-536 — it must narrow
  // to false so the forms fall back to their own default instead of persisting a
  // non-plane string as a plane.
  it.each(['', 'net', 'BRUTTO', undefined])('%j → false', (input) => {
    expect(isVatPlane(input)).toBe(false)
  })
})
