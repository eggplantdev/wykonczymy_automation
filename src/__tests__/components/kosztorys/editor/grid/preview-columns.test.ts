import { describe, expect, it } from 'vitest'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  buildV2Columns,
  buildV2Grid,
} from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { emptySettlementColumnIds } from '@/lib/kosztorys/settlement-columns'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

// Asserted on rendered ids rather than on the constant, because the ids are the document a client
// reads — a constant can be right while the selection still drops half of it.

const STAGES: KosztorysStageT[] = [
  makeStage({ id: 7, label: 'Etap 1', plane: null }),
  makeStage({ id: 9, ordinal: 2, label: 'Etap 2', plane: null }),
]

const stageRow = (overrides: Parameters<typeof row>[0] = {}) =>
  row({ [stageKey(7)]: 0, [stageKey(9)]: 0, ...overrides })

function previewIds(extra: Partial<BuildV2ColumnsOptsT> = {}): string[] {
  return buildV2Columns({ view: 'client', previewVisible: true, stages: STAGES, ...extra })
    .map((column) => column.id)
    .filter((id): id is string => id != null)
}

describe('preview columns', () => {
  it('is not narrowed by any owner reading preference', () => {
    const baseline = previewIds()
    const narrowed: Partial<BuildV2ColumnsOptsT>[] = [
      { moneyAxis: 'net' },
      { moneyAxis: 'gross' },
      { layer: 'progress' },
      { layer: 'work' },
      { isHidden: () => true },
    ]
    for (const opts of narrowed) expect(previewIds(opts)).toEqual(baseline)
  })

  it('drops the per-item rabat columns while a global discount overrides them', () => {
    const visible = previewIds({ globalDiscountActive: true })
    for (const id of ['discountType', 'discountValue', 'discountAmount']) {
      expect(previewIds()).toContain(id)
      expect(visible).not.toContain(id)
    }
  })

  it('reads the przedmiar as ilość, j.m., cena, wartość', () => {
    const visible = previewIds()
    const at = visible.indexOf('plannedQty')

    expect(visible.slice(at, at + 6)).toEqual([
      'plannedQty',
      'currentPlannedQty',
      'unit',
      'price',
      'plannedNet',
      'currentPlannedNet',
    ])
  })

  it('carries no brutto column', () => {
    const grossIds = [
      'plannedGross',
      'currentPlannedGross',
      'priceGross',
      'discountAmountGross',
      'gross',
      'remainingGross',
    ]
    const visible = previewIds()

    for (const id of grossIds) expect(visible).not.toContain(id)
    expect(visible.filter((id) => id.startsWith('stageValueGross'))).toEqual([])
  })

  it('follows the stored document order', () => {
    const visible = previewIds({ previewColumnRanks: { net: -2, stageQtySum: -1 } })

    expect(visible.slice(0, 3)).toEqual(['description', 'net', 'stageQtySum'])
  })

  it('keeps „Opis prac" first whatever rank it is given', () => {
    const visible = previewIds({ previewColumnRanks: { description: 99, net: -1 } })

    expect(visible.slice(0, 2)).toEqual(['description', 'net'])
  })

  it('is not reordered by the per-browser column order', () => {
    expect(previewIds({ columnRanks: { net: -1, description: 99 } })).toEqual(previewIds())
  })

  it('carries the offer and the progress together', () => {
    const visible = previewIds()
    for (const id of [
      'description',
      'plannedQty',
      'unit',
      'price',
      'net',
      'stageQtySum',
      'stage_7',
    ]) {
      expect(visible).toContain(id)
    }
    expect(visible).toContain('stageValueNet_7')
  })

  it('shows the komentarz only while the owner has it ticked', () => {
    expect(previewIds()).toContain('note')
    expect(previewIds({ documentHiddenColumns: new Set(['note']) })).not.toContain('note')
  })

  it('never surfaces the sheet pomiar to the client', () => {
    const columnData = (opts: Partial<BuildV2ColumnsOptsT>) =>
      buildV2Columns({ view: 'client', stages: STAGES, ...opts }).find(
        (column) => column.id === 'stageQtySum',
      )?.columnData as { tip?: unknown }

    expect(columnData({}).tip).toBeUndefined()
    expect(columnData({ previewVisible: true }).tip).toBeUndefined()
  })

  it('drops the columns the owner hid, and only those', () => {
    const baseline = previewIds()
    const visible = previewIds({ documentHiddenColumns: new Set(['unit']) })

    expect(visible).not.toContain('unit')
    expect(visible).toEqual(baseline.filter((id) => id !== 'unit'))
  })

  it('takes a per-etap family whole, from its group key', () => {
    const visible = previewIds({ documentHiddenColumns: new Set(['stageValueNet']) })

    expect(visible).not.toContain('stageValueNet_7')
    expect(visible).not.toContain('stageValueNet_9')
    expect(visible).toContain('stage_7')
  })

  it('drops an empty etap by its full ids and keeps the filled one', () => {
    const empty = emptySettlementColumnIds([stageRow({ [stageKey(7)]: 2 })], STAGES)
    const visible = previewIds({ documentHiddenColumns: empty })

    expect(visible).not.toContain('stage_9')
    expect(visible).not.toContain('stageValueNet_9')
    expect(visible).toContain('stage_7')
    expect(visible).toContain('stageValueNet_7')
    expect(visible).toContain('net')
  })

  it('cannot let a stored key add a column outside the allowlist', () => {
    expect(previewIds({ documentHiddenColumns: new Set(['aiPlannedQty']) })).not.toContain(
      'aiPlannedQty',
    )
  })

  it('ignores the hidden set outside the preview', () => {
    const editorIds = buildV2Columns({
      view: 'client',
      stages: STAGES,
      documentHiddenColumns: new Set(['unit']),
    }).map((column) => column.id)

    expect(editorIds).toContain('unit')
  })

  it('offers no column picker', () => {
    const { columnToggleItems } = buildV2Grid({
      view: 'client',
      previewVisible: true,
      stages: STAGES,
    })
    expect(columnToggleItems).toEqual([])
  })
})

describe('the pair: allowlist + price plane', () => {
  const unpinned = (view: 'w_tools' | 'own_tools') => () =>
    buildV2Columns({ view, previewVisible: true, stages: STAGES })

  it('throws on previewVisible without view=client', () => {
    expect(unpinned('w_tools')).toThrow(/previewVisible requires view='client'/)
    expect(unpinned('own_tools')).toThrow()
  })

  it('accepts the correct pair', () => {
    expect(() => previewIds()).not.toThrow()
  })

  it('cannot reach the subcontractor rate columns, in either plane', () => {
    const visible = previewIds()
    for (const plane of ['w_tools', 'own_tools'] as const) {
      for (const base of ['priceMode', 'priceCoeff', 'price'] as const) {
        expect(visible).not.toContain(planePriceKey(base, plane))
      }
    }
    const editorIds = buildV2Columns({ view: 'client', stages: STAGES, crewAxis: 'both' }).map(
      (c) => c.id,
    )
    expect(editorIds).toContain(planePriceKey('price', 'w_tools'))
    expect(editorIds).toContain(planePriceKey('price', 'own_tools'))
  })

  it('does not throw on the subcontractor plane alone', () => {
    expect(() => buildV2Columns({ view: 'w_tools', stages: STAGES })).not.toThrow()
  })
})
