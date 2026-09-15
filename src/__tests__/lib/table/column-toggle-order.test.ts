import { describe, expect, it } from 'vitest'
import { baseRanksFromKeys, orderColumnKeys, rankForMove } from '@/lib/table/column-order'

// The adapter's contract expressed over an id list, which is all it ever hands the algebra: what a
// DataTable column picker shows, and what one drop persists. The React seam is three props wide;
// the risk is in the ordering, so that is what this spec holds.
const COLUMNS = ['date', 'amount', 'type', 'description']
const BASE = baseRanksFromKeys(COLUMNS)

// The one drop the dialog commits: it writes a single rank, then the table re-derives its order.
function drop(from: string, toIndex: number, ranks = {}) {
  return orderColumnKeys(COLUMNS, {
    ...ranks,
    [from]: rankForMove(COLUMNS, from, toIndex, ranks, BASE),
  })
}

describe('column order for a DataTable', () => {
  it('leaves declaration order alone when nothing was dragged', () => {
    expect(orderColumnKeys(COLUMNS, {})).toEqual(COLUMNS)
  })

  it('sorts a column with no rank at its declared index, not at the end', () => {
    // 'description' is unranked; it must stay last because that is where the code puts it — the
    // whole reason ranks are sparse instead of a persisted array.
    expect(orderColumnKeys(COLUMNS, { date: 1.5 })).toEqual([
      'amount',
      'date',
      'type',
      'description',
    ])
  })

  it('moves the dragged column to the front', () => {
    expect(drop('type', 0)).toEqual(['type', 'date', 'amount', 'description'])
  })

  it('moves the dragged column to the end', () => {
    expect(drop('date', 3)).toEqual(['amount', 'type', 'description', 'date'])
  })

  it('drops a column between two others', () => {
    expect(drop('description', 1)).toEqual(['date', 'description', 'amount', 'type'])
  })

  it('keeps a second drop consistent with the first', () => {
    const first = { type: rankForMove(COLUMNS, 'type', 0, {}, BASE) }
    const after = orderColumnKeys(COLUMNS, first)
    expect(after).toEqual(['type', 'date', 'amount', 'description'])
    const second = {
      ...first,
      amount: rankForMove(after, 'amount', 0, first, BASE),
    }
    expect(orderColumnKeys(COLUMNS, second)).toEqual(['amount', 'type', 'date', 'description'])
  })

  it('ignores a rank for a column this table does not have', () => {
    // transfers shares one storage key across pages that exclude different columns.
    expect(orderColumnKeys(COLUMNS, { workerName: -5 })).toEqual(COLUMNS)
  })
})
