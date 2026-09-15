import { describe, expect, it } from 'vitest'
import {
  HEADER_ROW_HEIGHT,
  ITEM_ROW_HEIGHT,
  SECTION_BAND_ROW_HEIGHT,
  fitRowHeight,
  heightForLines,
  resolveHeaderRowHeight,
  resolveRowHeight,
} from '@/lib/kosztorys/row-height'
import { sectionHeaderRowId } from '@/lib/kosztorys/synthetic-rows'

describe('heightForLines', () => {
  it('gives a single line the grid’s resting row height', () => {
    expect(heightForLines(1)).toBe(ITEM_ROW_HEIGHT)
  })

  it('grows by one line height per extra line', () => {
    expect(heightForLines(2)).toBe(ITEM_ROW_HEIGHT + 20)
    expect(heightForLines(5)).toBe(ITEM_ROW_HEIGHT + 80)
  })

  it('never returns less than the resting height', () => {
    expect(heightForLines(0)).toBe(ITEM_ROW_HEIGHT)
  })

  it('has no upper bound — a very long description gets a very tall row', () => {
    expect(heightForLines(40)).toBe(ITEM_ROW_HEIGHT + 39 * 20)
  })
})

describe('resolveRowHeight', () => {
  it('rests a section band at its own height, and ignores the content there', () => {
    expect(resolveRowHeight({ isSectionBand: true })).toBe(SECTION_BAND_ROW_HEIGHT)
    expect(resolveRowHeight({ isSectionBand: true, contentLines: 9 })).toBe(SECTION_BAND_ROW_HEIGHT)
  })

  it('lets a drag move a section band off that height', () => {
    expect(resolveRowHeight({ isSectionBand: true, override: 200 })).toBe(200)
  })

  it('leaves an untouched row at the resting height', () => {
    expect(resolveRowHeight({ isSectionBand: false })).toBe(ITEM_ROW_HEIGHT)
  })

  it('uses the dragged height when there is one', () => {
    expect(resolveRowHeight({ isSectionBand: false, override: 96 })).toBe(96)
  })

  it('lets a drag win over what the content needs', () => {
    expect(resolveRowHeight({ isSectionBand: false, override: 32, contentLines: 6 })).toBe(32)
  })

  it('refuses to shrink a row below the resting height', () => {
    expect(resolveRowHeight({ isSectionBand: false, override: 4 })).toBe(ITEM_ROW_HEIGHT)
  })

  it('falls back to the content height where nothing was dragged', () => {
    expect(resolveRowHeight({ isSectionBand: false, contentLines: 3 })).toBe(heightForLines(3))
  })
})

describe('resolveRowHeight · the client preview never sees a drag', () => {
  // The owner drags rows flat in the editor and then opens „Widok inwestora" in the same browser,
  // so the same localStorage map is in scope for both. The preview passes no override at all —
  // pinned here because the leak clips exactly the descriptions the content fit exists to show.
  it('sizes to the content when no override is passed, whatever is stored elsewhere', () => {
    expect(resolveRowHeight({ isSectionBand: false, contentLines: 4 })).toBe(heightForLines(4))
  })

  it('ignores a corrupted stored height rather than passing NaN into the grid', () => {
    expect(resolveRowHeight({ isSectionBand: false, override: Number.NaN, contentLines: 3 })).toBe(
      heightForLines(3),
    )
    expect(resolveRowHeight({ isSectionBand: false, override: Number.NaN })).toBe(ITEM_ROW_HEIGHT)
  })
})

describe('fitRowHeight', () => {
  it('grows a row to what its text needs', () => {
    expect(fitRowHeight(42, 3)).toBe(heightForLines(3))
  })

  it('never fits a row below its resting height', () => {
    expect(fitRowHeight(42, 1)).toBe(ITEM_ROW_HEIGHT)
    expect(fitRowHeight(42, 0)).toBe(ITEM_ROW_HEIGHT)
  })

  // A band's resting height is taller than one line of text, so the shared floor in heightForLines
  // is not enough — fitting a band to its one-line label would shrink it.
  it('floors a section band at the band height, not the item height', () => {
    expect(fitRowHeight(sectionHeaderRowId(7), 1)).toBe(SECTION_BAND_ROW_HEIGHT)
    expect(fitRowHeight(sectionHeaderRowId(7), 4)).toBe(heightForLines(4))
  })
})

describe('resolveHeaderRowHeight', () => {
  it('rests the header at its own height when nothing was dragged', () => {
    expect(resolveHeaderRowHeight()).toBe(HEADER_ROW_HEIGHT)
  })

  it('uses the dragged height, and never shrinks below the resting one', () => {
    expect(resolveHeaderRowHeight(120)).toBe(120)
    expect(resolveHeaderRowHeight(10)).toBe(HEADER_ROW_HEIGHT)
  })

  // Same corruption path as the rows: the header's height rides the same localStorage map, and NaN
  // in dsg's layout arithmetic blanks the grid.
  it('ignores a corrupted stored height rather than passing NaN into the grid', () => {
    expect(resolveHeaderRowHeight(Number.NaN)).toBe(HEADER_ROW_HEIGHT)
  })
})
