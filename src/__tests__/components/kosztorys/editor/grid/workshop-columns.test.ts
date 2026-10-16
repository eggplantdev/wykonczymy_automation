import { describe, expect, it } from 'vitest'
import {
  buildV2Columns,
  buildV2Grid,
} from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { WORKSHOP_VISIBLE_COLUMNS } from '@/lib/kosztorys/workshop-columns'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

const STAGES: KosztorysStageT[] = [makeStage({ id: 7, label: 'Etap 1', plane: null })]

function workshopIds(extra: Partial<BuildV2ColumnsOptsT> = {}): string[] {
  return buildV2Columns({ view: 'client', workshopVisible: true, stages: STAGES, ...extra })
    .map((column) => column.id)
    .filter((id): id is string => id != null)
}

describe('workshop columns', () => {
  it('renders nothing outside the warsztat list', () => {
    for (const id of workshopIds()) {
      if (id === 'layerGap') continue
      expect(WORKSHOP_VISIBLE_COLUMNS.has(id)).toBe(true)
    }
    for (const id of ['plannedQty', 'net', 'gross', 'discountType', 'donePercent']) {
      expect(workshopIds()).not.toContain(id)
    }
  })

  it('is a ceiling no reading preference can lift', () => {
    expect(workshopIds({ isHidden: () => false, moneyAxis: 'both', layer: 'both' })).toEqual(
      workshopIds(),
    )
  })

  it('ignores the money axis and the layer', () => {
    expect(workshopIds({ moneyAxis: 'none', layer: 'none', crewAxis: 'none' })).toEqual(
      workshopIds(),
    )
  })

  it('hides a column the workbench picker unticked', () => {
    const ids = workshopIds({ isHidden: (id) => id === 'sectionName' })

    expect(ids).not.toContain('sectionName')
    expect(ids).toContain('description')
  })

  it('shows a column an engaged problem reveals, tick or no tick', () => {
    const ids = workshopIds({
      isHidden: (id) => id === 'workNote',
      revealedColumnIds: new Set(['workNote']),
    })

    expect(ids).toContain('workNote')
  })

  it('keeps the row-actions column whatever the picker says', () => {
    expect(workshopIds({ onRemoveItem: () => {}, isHidden: () => true })).toContain('actions')
  })

  it('reorders by the workbench rank map', () => {
    const ids = workshopIds({ columnRanks: { workNote: -1 } })

    expect(ids[0]).toBe('workNote')
  })

  it('carries the netto price and no brutto beside it', () => {
    expect(workshopIds()).toContain('price')
    expect(workshopIds()).not.toContain('priceGross')
  })

  it('shows the Komentarz do pracy', () => {
    expect(workshopIds()).toContain('workNote')
  })

  it('has no per-row Komentarz', () => {
    expect(workshopIds()).not.toContain('note')
  })

  it('carries each crew rate beside its source, on every plane', () => {
    for (const plane of TOOL_PLANES) {
      expect(workshopIds()).toContain(planePriceKey('priceMode', plane))
      expect(workshopIds()).toContain(planePriceKey('price', plane))
    }
  })

  it('shows the price source on the client view and never on the investor preview', () => {
    const idsFor = (previewVisible: boolean) =>
      buildV2Columns({ view: 'client', stages: STAGES, previewVisible, crewAxis: 'both' })
        .map((column) => column.id)
        .filter((id): id is string => id != null)

    for (const plane of TOOL_PLANES) {
      expect(idsFor(false)).toContain(planePriceKey('priceMode', plane))
      expect(idsFor(true)).not.toContain(planePriceKey('priceMode', plane))
    }
  })

  it('keeps the row-actions column, the only route to delete or move a pozycja', () => {
    expect(workshopIds({ onRemoveItem: () => {} })).toContain('actions')
  })

  it('offers the warsztat list in the picker and nothing outside it', () => {
    const { columnToggleItems } = buildV2Grid({
      view: 'client',
      workshopVisible: true,
      stages: STAGES,
      isHidden: (id) => id === 'workNote',
    })
    const ids = columnToggleItems.map((item) => item.id)

    expect(ids).toContain('description')
    expect(ids).not.toContain('actions')
    expect(ids.every((id) => WORKSHOP_VISIBLE_COLUMNS.has(id))).toBe(true)
    expect(columnToggleItems.find((item) => item.id === 'workNote')?.visible).toBe(false)
  })

  it('narrows nothing on an ordinary kosztorys', () => {
    const ordinary = buildV2Columns({ view: 'client', stages: STAGES })
      .map((column) => column.id)
      .filter((id): id is string => id != null)

    expect(ordinary).toContain('plannedQty')
    expect(ordinary).toContain('net')
  })
})
