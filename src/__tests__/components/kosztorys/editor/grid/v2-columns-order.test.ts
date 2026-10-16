import { describe, expect, it } from 'vitest'
import { buildV2Grid } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { STAGES_COLUMN_GROUP, stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

const STAGES: KosztorysStageT[] = [
  makeStage({ id: 7, label: 'Etap 1' }),
  makeStage({ id: 9, ordinal: 2, label: 'Etap 2' }),
]

const grid = (opts: Partial<BuildV2ColumnsOptsT> = {}) =>
  buildV2Grid({ view: 'client', stages: STAGES, ...opts })

const columnIds = (opts: Partial<BuildV2ColumnsOptsT> = {}) =>
  grid(opts)
    .columns.map((column) => column.id)
    .filter((id): id is string => id != null)

describe('column ranks in the assembled grid', () => {
  it('leaves the sheet order alone without a rank map', () => {
    expect(columnIds({ columnRanks: {} })).toEqual(columnIds())
  })

  it('lifts a ranked column ahead of the ones it was assembled behind', () => {
    const ids = columnIds({ columnRanks: { price: -1 } })
    expect(ids.indexOf('price')).toBeLessThan(ids.indexOf('plannedQty'))
  })

  it('reorders the chrome and identity columns too, keeping the trailing gap last', () => {
    const ids = columnIds({ onRemoveItem: () => {}, columnRanks: { actions: 99, description: -1 } })
    expect(ids[0]).toBe('description')
    expect(ids.at(-2)).toBe('actions')
    expect(ids.at(-1)).toBe('layerGap')
  })

  it('moves the stage columns as one block', () => {
    const ids = columnIds({ columnRanks: { [STAGES_COLUMN_GROUP]: 99 } })
    expect(ids.indexOf(stageKey(9))).toBe(ids.indexOf(stageKey(7)) + 1)
    expect(ids.indexOf(stageKey(7))).toBeGreaterThan(ids.indexOf('price'))
  })

  it('reorders the picker list with the grid', () => {
    const items = grid({ columnRanks: { price: -1 } }).columnToggleItems.map((item) => item.id)
    expect(items.indexOf('price')).toBeLessThan(items.indexOf('plannedQty'))
  })

  it('is ignored by the client preview', () => {
    const previewOpts = { view: 'client', previewVisible: true } as const
    expect(columnIds({ ...previewOpts, columnRanks: { price: -1 } })).toEqual(
      columnIds(previewOpts),
    )
  })
})

describe('columnBaseRanks', () => {
  it('stays on the sheet order after a column has been reranked', () => {
    expect(grid({ columnRanks: { price: -1 } }).columnBaseRanks).toEqual(grid().columnBaseRanks)
  })

  it('ranks every picker group exactly once, in sheet order', () => {
    const { columnBaseRanks, columnToggleItems } = grid()
    for (const item of columnToggleItems) expect(columnBaseRanks[item.id]).toBeTypeOf('number')
    expect(new Set(Object.values(columnBaseRanks)).size).toBe(Object.keys(columnBaseRanks).length)
  })
})
