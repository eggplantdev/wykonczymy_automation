import { describe, expect, it } from 'vitest'
import { resizableColumnIds, selectionTargetIds } from '@/lib/kosztorys/column-width-targets'

const columns = [
  { id: 'description', minWidth: 130 },
  { id: 'unit', minWidth: 60 },
  { id: 'price', minWidth: 100, maxWidth: 100 },
  { id: 'fixedFlag', minWidth: 48, maxWidth: 48 },
  { id: 'stage_7', minWidth: 90 },
  { id: 'actions', minWidth: 64, maxWidth: 64 },
  { id: 'layerGap', minWidth: 24, maxWidth: 400 },
  {},
]
const widths = { price: 100 }

const span = (from: number, to: number) => ({ min: { col: from }, max: { col: to } })

describe('resizableColumnIds', () => {
  it('keeps a column pinned by the user but drops design-fixed, action, gap and id-less ones', () => {
    expect(resizableColumnIds(columns, widths)).toEqual(['description', 'unit', 'price', 'stage_7'])
  })
})

describe('selectionTargetIds', () => {
  it('takes every resizable column of a span that covers the clicked one', () => {
    expect(selectionTargetIds(columns, widths, span(0, 4), 'unit')).toEqual([
      'description',
      'unit',
      'price',
      'stage_7',
    ])
  })

  it('falls back to the clicked column when the span does not reach it', () => {
    expect(selectionTargetIds(columns, widths, span(0, 1), 'stage_7')).toEqual(['stage_7'])
  })

  it('falls back to the clicked column with no selection', () => {
    expect(selectionTargetIds(columns, widths, null, 'unit')).toEqual(['unit'])
  })

  it('offers nothing for a clicked column that cannot take a width', () => {
    expect(selectionTargetIds(columns, widths, null, 'fixedFlag')).toEqual([])
  })
})
