import { describe, it, expect } from 'vitest'
import { moveItems, moveSection } from '@/lib/kosztorys/reorder-layout'

const LAYOUT = [
  { sectionId: 1, itemIds: [10, 11, 12] },
  { sectionId: 2, itemIds: [20, 21] },
  { sectionId: 3, itemIds: [30] },
]

describe('moveItems', () => {
  it('keeps a block gathered from two sections in its top-to-bottom order', () => {
    const result = moveItems(LAYOUT, new Set([21, 11]), { sectionId: 3, beforeItemId: 30 })

    expect(result).toEqual([
      { sectionId: 1, itemIds: [10, 12] },
      { sectionId: 2, itemIds: [20] },
      { sectionId: 3, itemIds: [11, 21, 30] },
    ])
  })

  it('leaves the layout as it was when the block is dropped before one of its own rows', () => {
    const result = moveItems(LAYOUT, new Set([11, 12]), { sectionId: 1, beforeItemId: 12 })

    expect(result).toEqual(LAYOUT)
  })

  it('appends at the section end when no row is named', () => {
    const result = moveItems(LAYOUT, new Set([10]), { sectionId: 2, beforeItemId: undefined })

    expect(result[1]).toEqual({ sectionId: 2, itemIds: [20, 21, 10] })
  })

  it('returns the layout unchanged for an unknown target section', () => {
    expect(moveItems(LAYOUT, new Set([10]), { sectionId: 99, beforeItemId: undefined })).toBe(
      LAYOUT,
    )
  })
})

describe('moveSection', () => {
  it('places a section before the named one', () => {
    expect(moveSection(LAYOUT, 3, 1).map((section) => section.sectionId)).toEqual([3, 1, 2])
  })

  it('places a section last when none is named', () => {
    expect(moveSection(LAYOUT, 1, undefined).map((section) => section.sectionId)).toEqual([2, 3, 1])
  })
})
