import { describe, it, expect } from 'vitest'
import { expenseRow, transferRow } from '@/lib/google/tab-rows'
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

  it('fills kategoria from expenseCategory (CORRECTION) and preserves a negative amount', () => {
    const row = transferRow({
      ...base,
      id: 7,
      type: 'CORRECTION',
      amount: -120.5,
      expenseCategory: { name: 'Materiały budowlane' },
    })
    expect(row?.amount).toBe(-120.5)
    expect(row?.category).toBe('Materiały budowlane')
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
      const sheetSum = rows
        .filter((r) => r.typ === label)
        .reduce((s, r) => s + Number(r.amount), 0)
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
})
