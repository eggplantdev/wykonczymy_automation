import { describe, expect, it } from 'vitest'

import { buildViewRows } from '@/lib/kosztorys/row-view'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// What the grid shows = search → engaged conditions → sort. The three compose, and the pipeline order
// is part of the contract: a condition applied after the sort would reorder the section blocks the
// bands assume are contiguous.

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
      engagedConditionIds: new Set(['no-planned-qty']),
    })

    // „malowanie sufitu" survives the search and is then hidden for having no przedmiar.
    expect(view.map((r) => r.id)).toEqual([1, 4])
  })

  it('holds a latched row against the condition that would hide it', () => {
    const view = buildViewRows({
      ...base,
      engagedConditionIds: new Set(['no-planned-qty']),
      latchedRowIds: new Set([2]),
    })

    expect(view.map((r) => r.id)).toEqual([1, 2, 3, 4])
  })

  // The latch answers „nie zabieraj mi wiersza, który poprawiam" — it says nothing about a question
  // the user is asking right now, and a search box that kept showing non-matches would be broken.
  it('does not hold a latched row against the search', () => {
    const view = buildViewRows({ ...base, search: 'aneks', latchedRowIds: new Set([1]) })

    expect(view.map((r) => r.id)).toEqual([3])
  })

  // Search first, then sort: the comparator must only ever see the rows that survived, and the
  // surviving set must be identical whichever way round it runs — this pins the set AND the order.
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
