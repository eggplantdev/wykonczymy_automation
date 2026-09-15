import { describe, expect, it } from 'vitest'
import {
  sectionBandLabelColumnId,
  sectionHeaderSlot,
} from '@/components/kosztorys/editor/grid/cells/section-header-cell'

// dsg has no colspan: exactly one column paints the section band's whole label and the rest go blank.
// Since no column holds a fixed slot any more (lib/table/column-order), that column is resolved
// off the visible order — a hard-coded „Opis prac" used to paint the band off-screen the moment the
// owner dragged it right, and not at all when the client view hid it.

describe('sectionBandLabelColumnId', () => {
  it('takes the column that leads the grid', () => {
    expect(sectionBandLabelColumnId(['sectionName', 'description', 'plannedQty'])).toBe(
      'sectionName',
    )
  })

  it('skips the chrome columns, which are too narrow or too empty to host a label', () => {
    expect(sectionBandLabelColumnId(['actions', 'description', 'plannedQty'])).toBe('description')
  })

  it('follows „Opis prac" when it is dragged away from the front', () => {
    expect(sectionBandLabelColumnId(['actions', 'plannedQty', 'description'])).toBe('plannedQty')
  })

  it('still names a column when „Opis prac" is hidden from the client altogether', () => {
    expect(sectionBandLabelColumnId(['sectionName', 'plannedQty', 'price'])).toBe('sectionName')
  })

  it('names none when the grid is chrome alone', () => {
    expect(sectionBandLabelColumnId(['actions', 'layerGap'])).toBeUndefined()
  })
})

describe('sectionHeaderSlot', () => {
  it('paints the label in the resolved column and blanks the rest', () => {
    expect(sectionHeaderSlot('sectionName', 'sectionName')).toBe('label')
    expect(sectionHeaderSlot('description', 'sectionName')).toBe('blank')
  })

  // Every column carries an id in the real grid; without this an id-less column would claim the band
  // off a `undefined === undefined` match and paint it twice.
  it('never lets an id-less column claim the band', () => {
    expect(sectionHeaderSlot(undefined, undefined)).toBe('blank')
  })

  // „Akcje" is the section's own „…" — the one band cell that opens a menu instead of collapsing,
  // which is what keeps a collapsed section's commands reachable.
  it('gives „Akcje" the menu slot rather than a blank', () => {
    expect(sectionHeaderSlot('actions', 'description')).toBe('actions')
  })

  // The two can't collide — sectionBandLabelColumnId treats „Akcje" as chrome — but the slot is
  // resolved independently, so nail down which one wins if that ever changes.
  it('keeps the menu slot even if „Akcje" were named the label column', () => {
    expect(sectionHeaderSlot('actions', 'actions')).toBe('actions')
  })
})
