import { describe, expect, it } from 'vitest'
import {
  baseRanksFromKeys,
  orderColumnKeys,
  orderColumns,
  rankForMove,
} from '@/lib/table/column-order'

// Assemble order as the grid builds it: actions leads, „Rozjazd" sits BEFORE the identity column.
const KEYS = ['actions', 'divergence', 'description', 'plannedQty', 'stages', 'price', 'net']

describe('orderColumnKeys', () => {
  it('leaves the assemble order untouched when no rank was stored', () => {
    expect(orderColumnKeys(KEYS, {})).toEqual(KEYS)
  })

  it('ranks every key, chrome and identity alike', () => {
    expect(orderColumnKeys(KEYS, { actions: 99, description: -99 })).toEqual([
      'description',
      'divergence',
      'plannedQty',
      'stages',
      'price',
      'net',
      'actions',
    ])
  })

  it('ignores a rank for a key that is not in the list', () => {
    expect(orderColumnKeys(KEYS, { gross: -100 })).toEqual(KEYS)
  })

  it('sorts by stored rank, falling back to the assemble index', () => {
    // divergence assembles at index 1, so a rank of 0.5 lifts „net" past it.
    expect(orderColumnKeys(KEYS, { net: 0.5 })).toEqual([
      'actions',
      'net',
      'divergence',
      'description',
      'plannedQty',
      'stages',
      'price',
    ])
  })
})

describe('rankForMove', () => {
  const baseRanks = baseRanksFromKeys(KEYS)

  it.each([0, 1, 2, 3, 4, 5, 6])('places the moved key at index %i', (toIndex) => {
    const rank = rankForMove(KEYS, 'price', toIndex, {}, baseRanks)
    expect(orderColumnKeys(KEYS, { price: rank }).indexOf('price')).toBe(toIndex)
  })

  it('round-trips a second move against the ranks written by the first', () => {
    const first = rankForMove(KEYS, 'price', 0, {}, baseRanks)
    const afterFirst = orderColumnKeys(KEYS, { price: first })
    const second = rankForMove(afterFirst, 'net', 1, { price: first }, baseRanks)
    expect(orderColumnKeys(KEYS, { price: first, net: second })).toEqual([
      'price',
      'net',
      'actions',
      'divergence',
      'description',
      'plannedQty',
      'stages',
    ])
  })

  it('leaves a single-key list alone', () => {
    expect(rankForMove(['price'], 'price', 0, {}, baseRanks)).toBe(baseRanks.price)
  })
})

describe('orderColumns', () => {
  const toKey = (id: string) => (id.startsWith('stage_') ? 'stages' : id)
  const columns = [
    { id: 'actions' },
    { id: 'description' },
    { id: 'stage_1' },
    { id: 'stage_2' },
    { id: 'price' },
  ]

  it('moves a stage group as one block, keeping its internal order', () => {
    expect(orderColumns(columns, { stages: 99 }, toKey).map((column) => column.id)).toEqual([
      'actions',
      'description',
      'price',
      'stage_1',
      'stage_2',
    ])
  })

  it('is a no-op without stored ranks', () => {
    expect(orderColumns(columns, {}, toKey)).toEqual(columns)
  })
})
