import { describe, expect, it } from 'vitest'
import {
  applyInsertItem,
  applyKosztorysOrder,
  catalogueSlicePlacement,
  sectionNeighbor,
  swapItemInSection,
} from '@/lib/kosztorys/row-ops'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// These movers read `id` and `sectionId` only — same fixture shape as section-row-ops.test.ts.
function row(id: number, sectionId: number): KosztorysV2RowT {
  return { id, sectionId } as KosztorysV2RowT
}

const ids = (rows: KosztorysV2RowT[]) => rows.map((r) => r.id)

// Section 1 = [1,2,3], section 2 = [4,5].
const rows = [row(1, 1), row(2, 1), row(3, 1), row(4, 2), row(5, 2)]

describe('applyInsertItem', () => {
  it('splices at the anchor for „powyżej" and just past it for „poniżej"', () => {
    expect(ids(applyInsertItem(rows, 2, row(9, 1), 'above'))).toEqual([1, 9, 2, 3, 4, 5])
    expect(ids(applyInsertItem(rows, 2, row(9, 1), 'below'))).toEqual([1, 2, 9, 3, 4, 5])
  })

  it('lands at the array position of the anchor, not of its section', () => {
    // „poniżej" the last row of section 1 puts the new row before section 2's block, so the two
    // bands stay whole.
    expect(ids(applyInsertItem(rows, 3, row(9, 1), 'below'))).toEqual([1, 2, 3, 9, 4, 5])
  })

  it('returns the same reference for an unknown anchor', () => {
    expect(applyInsertItem(rows, 99, row(9, 1), 'below')).toBe(rows)
  })
})

describe('applyKosztorysOrder', () => {
  it('re-lays each section in the sequence sent, leaving the section order alone', () => {
    expect(ids(applyKosztorysOrder(rows, [3, 1, 2, 5, 4]))).toEqual([3, 1, 2, 5, 4])
  })

  it('is indifferent to the sequence’s own grouping — only within-section rank matters', () => {
    // Sections interleaved in the payload; each block still reads its own members in order.
    expect(ids(applyKosztorysOrder(rows, [5, 3, 4, 2, 1]))).toEqual([3, 2, 1, 5, 4])
  })

  it('leaves an unmentioned row in the slot it already occupies', () => {
    // Row 2 is absent from the sequence, so it holds index 1 and only rows 1 and 3 permute around it.
    expect(ids(applyKosztorysOrder(rows, [3, 1]))).toEqual([3, 2, 1, 4, 5])
  })

  it('ignores ids that no longer exist', () => {
    expect(ids(applyKosztorysOrder(rows, [3, 99, 1, 2]))).toEqual([3, 1, 2, 4, 5])
  })

  it('is a no-op for a sequence that matches the current order', () => {
    expect(ids(applyKosztorysOrder(rows, [1, 2, 3, 4, 5]))).toEqual([1, 2, 3, 4, 5])
  })
})

describe('swapItemInSection', () => {
  it('exchanges a row with its section neighbour', () => {
    expect(ids(swapItemInSection(rows, 2, 'up'))).toEqual([2, 1, 3, 4, 5])
    expect(ids(swapItemInSection(rows, 2, 'down'))).toEqual([1, 3, 2, 4, 5])
  })

  it('never crosses a section boundary', () => {
    expect(swapItemInSection(rows, 3, 'down')).toBe(rows)
    expect(swapItemInSection(rows, 4, 'up')).toBe(rows)
  })

  // The reorder-undo regression: the undo used to replay the neighbour id captured when the swap was
  // pushed, while the server exchanges with whatever is rank-adjacent NOW. Insert a row between the
  // pair and the two disagree until reload. Re-deriving the reversal with the same primitive the
  // forward gesture uses makes both halves the same operation by construction.
  it('reverses against the CURRENT neighbour after a row was inserted between the pair', () => {
    const swapped = swapItemInSection(rows, 1, 'down') // [2,1,3,...]
    const between = applyInsertItem(swapped, 1, row(9, 1), 'above') // [2,9,1,3,...]

    // Not row 2 — the id the old undo had captured.
    expect(sectionNeighbor(between, 1, 'up')?.id).toBe(9)
    expect(ids(swapItemInSection(between, 1, 'up'))).toEqual([2, 1, 9, 3, 4, 5])
  })
})

describe('catalogueSlicePlacement', () => {
  it('prepends a sekcja the picker just minted', () => {
    expect(catalogueSlicePlacement(rows, 9, true)).toBe('prepend')
  })

  it('folds into a sekcja the grid already holds rows for', () => {
    expect(catalogueSlicePlacement(rows, 2, false)).toBe('fold')
  })

  it('reseeds when the server appended into a sekcja absent from the grid', () => {
    // An emptied sekcja renders no row, so it is missing from the picker's list and the owner types
    // its nazwa — the server matches it and reports no mint. Folding would park the band past
    // sekcja 2; nothing on screen can anchor it.
    expect(catalogueSlicePlacement(rows, 3, false)).toBe('reseed')
  })
})
