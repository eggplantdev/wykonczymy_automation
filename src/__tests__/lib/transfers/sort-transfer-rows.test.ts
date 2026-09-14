import { describe, it, expect } from 'vitest'
import { sortTransferRows } from '@/lib/transfers/sort-transfer-rows'
import { transferRow as row } from '@/__tests__/fixtures/transfer-row'

describe('sortTransferRows', () => {
  it('returns the input untouched when nothing is sorted', () => {
    const rows = [row({ id: 2 }), row({ id: 1 })]
    expect(sortTransferRows(rows, [])).toBe(rows)
  })

  it('sorts on the row key behind an aliased column id', () => {
    const rows = [row({ id: 1, investmentName: 'Zamek' }), row({ id: 2, investmentName: 'Altana' })]
    const sorted = sortTransferRows(rows, [{ id: 'investment', desc: false }])
    expect(sorted.map((r) => r.id)).toEqual([2, 1])
  })

  it('reverses on desc', () => {
    const rows = [row({ id: 1, amount: 100 }), row({ id: 2, amount: 300 })]
    const sorted = sortTransferRows(rows, [{ id: 'amount', desc: true }])
    expect(sorted.map((r) => r.id)).toEqual([2, 1])
  })

  it('falls through to the next key when the first ties', () => {
    const rows = [
      row({ id: 1, date: '2026-01-02', amount: 50 }),
      row({ id: 2, date: '2026-01-02', amount: 10 }),
      row({ id: 3, date: '2026-01-01', amount: 999 }),
    ]
    const sorted = sortTransferRows(rows, [
      { id: 'date', desc: false },
      { id: 'amount', desc: false },
    ])
    expect(sorted.map((r) => r.id)).toEqual([3, 2, 1])
  })

  it('puts null first regardless of the comparison that follows', () => {
    const rows = [row({ id: 1, paymentMethod: 'CASH' }), row({ id: 2, paymentMethod: null })]
    const sorted = sortTransferRows(rows, [{ id: 'paymentMethod', desc: false }])
    expect(sorted.map((r) => r.id)).toEqual([2, 1])
  })

  it('does not mutate the input array', () => {
    const rows = [row({ id: 1, amount: 300 }), row({ id: 2, amount: 100 })]
    sortTransferRows(rows, [{ id: 'amount', desc: false }])
    expect(rows.map((r) => r.id)).toEqual([1, 2])
  })
})
