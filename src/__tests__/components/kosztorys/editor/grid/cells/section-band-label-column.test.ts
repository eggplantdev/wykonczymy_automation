import { describe, expect, it } from 'vitest'
import {
  sectionBandLabelColumnId,
  sectionHeaderSlot,
} from '@/components/kosztorys/editor/grid/cells/section-header-cell'

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

  // without this an id-less column would claim the band off a `undefined === undefined` match and paint it twice.
  it('never lets an id-less column claim the band', () => {
    expect(sectionHeaderSlot(undefined, undefined)).toBe('blank')
  })

  it('gives „Akcje" the menu slot rather than a blank', () => {
    expect(sectionHeaderSlot('actions', 'description')).toBe('actions')
  })

  it('keeps the menu slot even if „Akcje" were named the label column', () => {
    expect(sectionHeaderSlot('actions', 'actions')).toBe('actions')
  })
})
