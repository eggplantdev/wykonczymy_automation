import { describe, expect, it } from 'vitest'
import { buildV2Grid } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { ALL_TRANSLATION_COLUMN_KEYS } from '@/lib/kosztorys/translation-column-keys'
import type { MeasureDiscrepancyT } from '@/lib/kosztorys/settlement-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { gridColumnIds, STAGES_7_9 } from '@/__tests__/helpers/grid-columns'

const DIVERGED = {
  id: 1,
  sectionId: 10,
  plannedQty: 95,
  sheetMeasuredQty: 95,
  discountType: null,
  discountValue: 0,
  clientPrice: 100,
  globalDiscountActive: false,
  [stageKey(7)]: 55,
  [stageKey(9)]: 0,
} as unknown as KosztorysV2RowT

const ids = (opts: Partial<BuildV2ColumnsOptsT> = {}) =>
  gridColumnIds({ view: 'client', stages: STAGES_7_9, ...opts })

describe('the „Rozjazd między arkuszem Google a apką" column', () => {
  it('is absent while the diagnostic is not engaged', () => {
    expect(ids()).not.toContain('divergence')
    expect(ids({ divergenceFilterEngaged: false })).not.toContain('divergence')
  })

  it('ignores a stored hide tick', () => {
    expect(ids({ divergenceFilterEngaged: true, isHidden: (id) => id === 'divergence' })).toContain(
      'divergence',
    )
  })

  it('never appears in the column picker', () => {
    const { columnToggleItems } = buildV2Grid({
      view: 'client',
      stages: STAGES_7_9,
      divergenceFilterEngaged: true,
    })
    expect(columnToggleItems.map((item) => item.id)).not.toContain('divergence')
  })

  it('follows the identity block once the diagnostic is engaged', () => {
    expect(
      ids({ divergenceFilterEngaged: true }).slice(0, 3 + ALL_TRANSLATION_COLUMN_KEYS.length),
    ).toEqual(['sectionName', 'description', ...ALL_TRANSLATION_COLUMN_KEYS, 'divergence'])
  })

  it('sits behind the row-actions column when editing is enabled', () => {
    expect(ids({ divergenceFilterEngaged: true, onRemoveItem: () => {} })).toEqual([
      'actions',
      ...ids({ divergenceFilterEngaged: true }),
    ])
  })

  it('never reaches the client preview', () => {
    expect(ids({ divergenceFilterEngaged: true, previewVisible: true })).not.toContain('divergence')
  })

  it('is absent on a subcontractor plane', () => {
    expect(ids({ divergenceFilterEngaged: true, view: 'w_tools' })).not.toContain('divergence')
  })

  it('carries both figures for the cell to render', () => {
    const column = buildV2Grid({
      view: 'client',
      stages: STAGES_7_9,
      divergenceFilterEngaged: true,
    }).columns.find((candidate) => candidate.id === 'divergence')
    const { divergenceFor } = column?.columnData as {
      divergenceFor: (r: KosztorysV2RowT) => MeasureDiscrepancyT | null
    }
    expect(divergenceFor(DIVERGED)).toMatchObject({ qtyDiff: 40, net: 4000 })
    expect(divergenceFor({ ...DIVERGED, sheetMeasuredQty: 55 })).toBeNull()
  })
})
