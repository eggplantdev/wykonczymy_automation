import { describe, expect, it } from 'vitest'

import { buildViewRows, type ViewLatchT } from '@/lib/kosztorys/row-view'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function row(
  id: number,
  sectionId: number,
  description: string,
  plannedQty: number,
): KosztorysV2RowT {
  return {
    id,
    sectionId,
    description,
    plannedQty,
    sectionName: 'Sekcja',
    unit: 'm2',
  } as KosztorysV2RowT
}

const ROWS = [
  row(1, 10, 'malowanie ścian', 4),
  row(2, 10, 'malowanie sufitu', 0),
  row(3, 20, 'aneks kuchenny', 2),
  row(4, 20, 'malowanie okien', 7),
]

// Ranked in the order given — the order the view had when the latch took it.
function latchOf(ids: number[]): ViewLatchT {
  return { ids: new Set(ids), rank: new Map(ids.map((id, index) => [id, index])) }
}

const base = {
  rows: ROWS,
  search: '',
  engagedConditionIds: new Set<string>(),
  sort: null,
  view: 'client' as const,
  stages: [],
  hasSettledMaterial: false,
  divergentPriceRowIds: new Set<number>(),
}

describe('buildViewRows', () => {
  it('returns the dataset untouched with no search, no condition and no sort', () => {
    expect(buildViewRows(base).map((r) => r.id)).toEqual([1, 2, 3, 4])
  })

  it('searches description case-insensitively', () => {
    expect(buildViewRows({ ...base, search: 'MALOWANIE' }).map((r) => r.id)).toEqual([1, 2, 4])
  })

  it('applies an engaged condition on top of the search', () => {
    const view = buildViewRows({
      ...base,
      search: 'malowanie',
      engagedConditionIds: new Set(['has-planned-qty']),
    })

    expect(view.map((r) => r.id)).toEqual([1, 4])
  })

  it('holds a latched row against the condition that would leave it out', () => {
    const view = buildViewRows({
      ...base,
      engagedConditionIds: new Set(['has-planned-qty']),
      latch: latchOf([2]),
    })

    expect(view.map((r) => r.id)).toEqual([1, 2, 3, 4])
  })

  it('holds a latched row against the search it stopped matching', () => {
    const view = buildViewRows({ ...base, search: 'aneks', latch: latchOf([1, 3]) })

    expect(view.map((r) => r.id)).toEqual([1, 3])
  })

  it('sorts what the search left, within sections', () => {
    const view = buildViewRows({
      ...base,
      search: 'malowanie',
      sort: { field: 'description', dir: 'asc', scope: 'section' },
    })

    expect(view.map((r) => r.id)).toEqual([2, 1, 4])
  })

  it('sorts across sections under the global scope', () => {
    const view = buildViewRows({
      ...base,
      sort: { field: 'description', dir: 'asc', scope: 'global' },
    })

    // pl collation: „okien" < „sufitu" < „ścian".
    expect(view.map((r) => r.id)).toEqual([3, 4, 2, 1])
  })
})

describe('buildViewRows under a frozen sort', () => {
  const withQty = (id: number, plannedQty: number) =>
    ROWS.map((r) => (r.id === id ? { ...r, plannedQty } : r))

  it('keeps the frozen order within sections when the sorted value is edited', () => {
    const sort = { field: 'plannedQty', dir: 'asc', scope: 'section' } as const
    const latch = latchOf([2, 1, 3, 4])

    expect(buildViewRows({ ...base, sort, latch }).map((r) => r.id)).toEqual([2, 1, 3, 4])
    const view = buildViewRows({ ...base, rows: withQty(2, 9), sort, latch })

    expect(view.map((r) => r.id)).toEqual([2, 1, 3, 4])
  })

  it('keeps the frozen order across sections when the sorted value is edited', () => {
    const sort = { field: 'plannedQty', dir: 'asc', scope: 'global' } as const
    const view = buildViewRows({
      ...base,
      rows: withQty(3, 50),
      sort,
      latch: latchOf([2, 3, 1, 4]),
    })

    expect(view.map((r) => r.id)).toEqual([2, 3, 1, 4])
  })

  it('appends a row the latch has not ranked at the end of its section', () => {
    const view = buildViewRows({
      ...base,
      rows: [...ROWS, row(5, 10, 'gruntowanie', 1)],
      sort: { field: 'plannedQty', dir: 'asc', scope: 'section' },
      latch: latchOf([2, 1, 3, 4]),
    })

    expect(view.map((r) => r.id)).toEqual([2, 1, 5, 3, 4])
  })

  it('appends a row the latch has not ranked at the end of the list under the global scope', () => {
    const view = buildViewRows({
      ...base,
      rows: [...ROWS, row(5, 10, 'gruntowanie', 1)],
      sort: { field: 'plannedQty', dir: 'asc', scope: 'global' },
      latch: latchOf([2, 3, 1, 4]),
    })

    expect(view.map((r) => r.id)).toEqual([2, 3, 1, 4, 5])
  })
})
