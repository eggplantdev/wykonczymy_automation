import { describe, it, expect } from 'vitest'
import { moveItems, moveSection, resolveDropTarget } from '@/lib/kosztorys/reorder-layout'

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

  it.each([
    ['at the section end', new Set([11, 12]), 12],
    ['above an unmoved row', new Set([10, 11]), 11],
  ])(
    'leaves the layout as it was when a block %s is dropped before one of its own rows',
    (_, moved, beforeItemId) => {
      expect(moveItems(LAYOUT, moved, { sectionId: 1, beforeItemId })).toEqual(LAYOUT)
    },
  )

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

describe('resolveDropTarget', () => {
  const items = { kind: 'items' } as const
  const none = new Set<number>()

  it('drops above a row in its upper half and below it in the lower half', () => {
    const over = (upperHalf: boolean) =>
      resolveDropTarget(LAYOUT, items, { sectionId: 1, itemId: 11, upperHalf }, none)

    expect(over(true)).toEqual({ kind: 'items', sectionId: 1, beforeItemId: 11 })
    expect(over(false)).toEqual({ kind: 'items', sectionId: 1, beforeItemId: 12 })
  })

  it('drops at the end after the last row of a section', () => {
    const target = resolveDropTarget(
      LAYOUT,
      items,
      { sectionId: 2, itemId: 21, upperHalf: false },
      none,
    )
    expect(target).toEqual({ kind: 'items', sectionId: 2, beforeItemId: undefined })
  })

  it('drops at the top of an open section from its header, at the end of a folded one', () => {
    const header = { sectionId: 1, itemId: undefined, upperHalf: true }

    expect(resolveDropTarget(LAYOUT, items, header, none)).toEqual({
      kind: 'items',
      sectionId: 1,
      beforeItemId: 10,
    })
    expect(resolveDropTarget(LAYOUT, items, header, new Set([1]))).toEqual({
      kind: 'items',
      sectionId: 1,
      beforeItemId: undefined,
    })
  })

  it('puts a dragged section before the hovered block or before the next one', () => {
    const section = { kind: 'section', sectionId: 3 } as const
    const over = (sectionId: number, upperHalf: boolean) =>
      resolveDropTarget(LAYOUT, section, { sectionId, itemId: undefined, upperHalf }, none)

    expect(over(1, true)).toEqual({ kind: 'section', beforeSectionId: 1 })
    expect(over(1, false)).toEqual({ kind: 'section', beforeSectionId: 2 })
    expect(over(3, false)).toEqual({ kind: 'section', beforeSectionId: undefined })
  })
})
