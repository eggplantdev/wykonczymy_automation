import { describe, it, expect } from 'vitest'
import { expenseRow, settledExpenseRow, transferRow, type TxDocT } from '@/lib/google/tab-rows'
import { SHEET_TRANSFER_TAB_TYPES, TRANSFER_TYPE_LABELS } from '@/lib/constants/transfers'

const base = { date: '2026-06-01T00:00:00.000Z', description: 'x', invoiceNote: '' }

describe('transferRow', () => {
  it('maps each of the six types to the 8-column shape with the PL type label', () => {
    for (const type of SHEET_TRANSFER_TAB_TYPES) {
      const row = transferRow({ ...base, id: 7, type, amount: 100 })
      expect(row).toEqual({
        transferId: 7,
        date: '2026-06-01',
        typ: TRANSFER_TYPE_LABELS[type],
        description: 'x',
        amount: 100,
        worker: '',
        category: '',
        note: '',
      })
    }
  })

  it('fills pracownik from the worker relation (PAYOUT)', () => {
    const row = transferRow({ ...base, id: 7, type: 'PAYOUT', amount: 50, worker: { name: 'Jan' } })
    expect(row?.worker).toBe('Jan')
  })

  it('returns undefined for a CORRECTION (now mirrored on the expenses tab, not here)', () => {
    expect(
      transferRow({
        ...base,
        id: 7,
        type: 'CORRECTION',
        amount: -120.5,
        expenseCategory: { name: 'Materiały budowlane' },
      }),
    ).toBeUndefined()
  })

  it('returns undefined for types outside the six (never a row on this tab)', () => {
    for (const type of ['INVESTMENT_EXPENSE', 'CANCELLATION', 'COMPANY_FUNDING', 'OTHER']) {
      expect(transferRow({ ...base, id: 7, type, amount: 10 })).toBeUndefined()
    }
  })

  it('skips a non-finite amount (would corrupt SUMIF totals)', () => {
    expect(transferRow({ ...base, id: 7, type: 'PAYOUT', amount: '' })).toBeUndefined()
    expect(transferRow({ ...base, id: 7, type: 'PAYOUT', amount: 'x' })).toBeUndefined()
  })
})

// Criterion 2: per-type SUMIF over emitted rows must equal the filtered-view
// totals 1:1. sumFilteredByType sums amount AS-IS with `cancelled IS NOT TRUE`,
// scoped to the investment — replicate that selection over a seeded dataset and
// compare against the sum of the rows transferRow() emits.
describe('sheet totals == filtered view (criterion 2)', () => {
  type DocT = {
    id: number
    type: string
    amount: number
    investment?: number
    cancelled?: boolean
    worker?: { name: string }
  } & typeof base
  const docs: DocT[] = [
    { id: 1, type: 'INVESTOR_DEPOSIT', amount: 1000, investment: 31, ...base },
    { id: 2, type: 'LABOR_COST', amount: 400, investment: 31, ...base },
    { id: 3, type: 'RABAT', amount: 50, investment: 31, ...base },
    { id: 4, type: 'PAYOUT', amount: 300, investment: 31, worker: { name: 'Jan' }, ...base },
    { id: 5, type: 'PAYOUT', amount: 999, investment: 31, cancelled: true, ...base }, // excluded
    { id: 6, type: 'CORRECTION', amount: -120, investment: 31, ...base }, // sign preserved
    { id: 7, type: 'CORRECTION', amount: 80, investment: 31, ...base },
    { id: 8, type: 'LOSS', amount: 60, investment: 31, ...base },
    { id: 9, type: 'LOSS', amount: 77, ...base }, // no investment → never on any tab
    { id: 10, type: 'INVESTMENT_EXPENSE', amount: 500, investment: 31, ...base }, // other tab
    { id: 11, type: 'PAYOUT', amount: 111, investment: 32, ...base }, // other investment
  ]

  // The desired row set for investment 31 (mirrors loadAppTransferRows' where).
  const desired = docs.filter(
    (d) =>
      d.investment === 31 &&
      (SHEET_TRANSFER_TAB_TYPES as readonly string[]).includes(d.type) &&
      d.cancelled !== true,
  )

  // What sumFilteredByType would return for investment 31, per type.
  const dbTotal = (type: string) =>
    docs
      .filter((d) => d.investment === 31 && d.type === type && d.cancelled !== true)
      .reduce((s, d) => s + Number(d.amount), 0)

  it('per-type sum of emitted kwota equals the filtered-view total for every type', () => {
    const rows = desired.map((d) => transferRow(d)).filter((r) => r !== undefined)
    for (const type of SHEET_TRANSFER_TAB_TYPES) {
      const label = TRANSFER_TYPE_LABELS[type]
      const sheetSum = rows.filter((r) => r.typ === label).reduce((s, r) => s + Number(r.amount), 0)
      expect(sheetSum).toBe(dbTotal(type))
    }
  })

  it('unlinked LOSS and cancelled transfers emit no row', () => {
    const ids = desired.map((d) => d.id)
    expect(ids).not.toContain(5)
    expect(ids).not.toContain(9)
  })
})

describe('expenseRow (behavior unchanged by the refactor)', () => {
  it('maps an expense and slices the ISO date', () => {
    expect(
      expenseRow({
        id: 3,
        amount: 250,
        date: '2026-05-27T00:00:00.000Z',
        description: 'cement',
        invoiceNote: 'FV/1',
        expenseCategory: { name: 'Materiały budowlane' },
        otherCategory: { name: 'Łazienka' },
      }),
    ).toEqual({
      transferId: 3,
      date: '2026-05-27',
      typ: 'Materiały budowlane',
      description: 'cement',
      amount: 250,
      category: 'Łazienka',
      note: 'FV/1',
    })
  })

  it('skips a missing category and a non-finite amount', () => {
    expect(expenseRow({ id: 3, amount: 250, expenseCategory: null })).toBeUndefined()
    expect(
      expenseRow({ id: 3, amount: '', expenseCategory: { name: 'Materiały budowlane' } }),
    ).toBeUndefined()
  })

  it('builds a row for a typed CORRECTION and preserves the negative amount', () => {
    const row = expenseRow({
      ...base,
      id: 9,
      type: 'CORRECTION',
      amount: -120,
      expenseCategory: { name: 'Materiały budowlane' },
    })
    expect(row).toBeDefined()
    expect(row!.amount).toBe(-120)
    expect(row!.typ).toBe('Materiały budowlane')
  })

  it('skips an untyped CORRECTION', () => {
    expect(expenseRow({ ...base, id: 10, type: 'CORRECTION', amount: -50 })).toBeUndefined()
  })
})

// Billing fix: a settled ("wliczone w robociznę") expense must not reach the client's
// SUM(E:E)/SUMIF, so on the BILL tab its column-E `amount` is 0 and its type is suffixed
// " rozliczone" to mark the 0-cost line. The real amount lives on the separate tab
// (settledExpenseRow), not here.
describe('expenseRow — settled (R+M) routing (bill tab)', () => {
  it('settled INVESTMENT_EXPENSE: kwota 0, type suffixed " rozliczone"', () => {
    const row = expenseRow({
      ...base,
      id: 11,
      type: 'INVESTMENT_EXPENSE',
      amount: 250,
      settled: true,
      expenseCategory: { name: 'Materiały budowlane' },
    })
    expect(row).toBeDefined()
    expect(row!.amount).toBe(0)
    expect(row!.typ).toBe('Materiały budowlane rozliczone')
    expect(row!.settledAmount).toBeUndefined()
  })

  it('settled CORRECTION (negative): kwota 0, type suffixed', () => {
    const row = expenseRow({
      ...base,
      id: 12,
      type: 'CORRECTION',
      amount: -120,
      settled: true,
      expenseCategory: { name: 'Materiały budowlane' },
    })
    expect(row!.amount).toBe(0)
    expect(row!.typ).toBe('Materiały budowlane rozliczone')
  })

  it('non-settled expense: kwota = amount, plain type', () => {
    const row = expenseRow({
      ...base,
      id: 13,
      type: 'INVESTMENT_EXPENSE',
      amount: 250,
      settled: false,
      expenseCategory: { name: 'Materiały budowlane' },
    })
    expect(row!.amount).toBe(250)
    expect(row!.typ).toBe('Materiały budowlane')
  })

  it('absent settled flag is treated as non-settled', () => {
    const row = expenseRow({
      ...base,
      id: 14,
      amount: 99,
      expenseCategory: { name: 'Materiały budowlane' },
    })
    expect(row!.amount).toBe(99)
    expect(row!.typ).toBe('Materiały budowlane')
  })

  it('a non-finite amount is skipped even when settled', () => {
    expect(
      expenseRow({
        ...base,
        id: 15,
        amount: '',
        settled: true,
        expenseCategory: { name: 'Materiały budowlane' },
      }),
    ).toBeUndefined()
  })
})

// Bridge invariant (3.3): the bug FAZA 1 + FAZA 2 each tested per-plane but nothing
// crossed — app-math excluded settled, row-mapping suffixed settled, but no test asserted
// the bill tab's client-facing SUM(E:E) obeys the same exclusion. This is that test: seed
// a MIXED settled/non-settled dataset through `expenseRow` (the bill-tab builder) and assert
// the column-E total the client sums equals only the non-settled real amounts. Proven red
// against pre-FAZA-2 behavior (settled mirrored at real amount) before landing.
describe('bill tab SUM(E:E) excludes settled — bridge invariant (3.3)', () => {
  const mat = { name: 'Materiały budowlane' }
  // Mixed: settled rows carry real amounts that MUST NOT reach the client total.
  const docs: TxDocT[] = [
    { ...base, id: 1, amount: 250, expenseCategory: mat }, // non-settled
    { ...base, id: 2, amount: 500, settled: true, expenseCategory: mat }, // settled → 0
    { ...base, id: 3, amount: -120, expenseCategory: mat }, // non-settled credit
    { ...base, id: 4, amount: 1000, settled: true, expenseCategory: mat }, // settled → 0
    { ...base, id: 5, amount: 99, settled: false, expenseCategory: mat }, // explicit non-settled
  ]
  const rows = docs.map(expenseRow).filter((r) => r !== undefined)

  // What the client's SUM(E:E) over the bill tab actually adds up.
  const columnESum = rows.reduce((s, r) => s + Number(r.amount), 0)
  // What it SHOULD be: only the non-settled real amounts (settled is company-absorbed).
  const nonSettledTotal = docs.filter((d) => !d.settled).reduce((s, d) => s + Number(d.amount), 0)

  it('(a) every settled row writes column-E amount 0', () => {
    const settledRows = docs
      .filter((d) => d.settled)
      .map(expenseRow)
      .filter((r) => r !== undefined)
    expect(settledRows.length).toBe(2)
    for (const r of settledRows) expect(r.amount).toBe(0)
  })

  it('(b) Σ(column-E) over the bill tab == Σ(non-settled real amounts)', () => {
    expect(columnESum).toBe(nonSettledTotal)
    expect(columnESum).toBe(250 - 120 + 99) // 229 — the two settled (500, 1000) excluded
  })

  it('(c) settled rows still appear on the bill tab, type suffixed " rozliczone"', () => {
    const settledRows = rows.filter((r) => String(r.typ).endsWith(' rozliczone'))
    expect(settledRows.length).toBe(2)
    for (const r of settledRows) expect(r.typ).toBe('Materiały budowlane rozliczone')
  })
})

// The separate "rozliczone R+M" tab shows settled expenses at their REAL amount, plain type.
describe('settledExpenseRow (rozliczone tab)', () => {
  it('settled expense → real amount, plain category type', () => {
    const row = settledExpenseRow({
      ...base,
      id: 21,
      type: 'INVESTMENT_EXPENSE',
      amount: 250,
      settled: true,
      expenseCategory: { name: 'Materiały budowlane' },
    })
    expect(row).toBeDefined()
    expect(row!.amount).toBe(250)
    expect(row!.typ).toBe('Materiały budowlane')
  })

  it('settled CORRECTION keeps its negative amount', () => {
    const row = settledExpenseRow({
      ...base,
      id: 22,
      type: 'CORRECTION',
      amount: -120,
      settled: true,
      expenseCategory: { name: 'Materiały budowlane' },
    })
    expect(row!.amount).toBe(-120)
  })

  it('non-settled expense → undefined (belongs only on the bill tab)', () => {
    expect(
      settledExpenseRow({
        ...base,
        id: 23,
        type: 'INVESTMENT_EXPENSE',
        amount: 250,
        settled: false,
        expenseCategory: { name: 'Materiały budowlane' },
      }),
    ).toBeUndefined()
  })

  it('missing category or non-finite amount → undefined', () => {
    expect(settledExpenseRow({ ...base, id: 24, amount: 250, settled: true })).toBeUndefined()
    expect(
      settledExpenseRow({
        ...base,
        id: 25,
        amount: '',
        settled: true,
        expenseCategory: { name: 'Materiały budowlane' },
      }),
    ).toBeUndefined()
  })
})
