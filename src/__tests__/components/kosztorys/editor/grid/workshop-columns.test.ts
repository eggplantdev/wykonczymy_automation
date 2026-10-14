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

// The szablon workbench narrows the grid to what a szablon actually carries. The assertions read
// the RENDERED ids rather than the constant — the constant can be right while the selection still
// lets a column through, or drops one.

const STAGES: KosztorysStageT[] = [makeStage({ id: 7, label: 'Etap 1', plane: null })]

function workshopIds(extra: Partial<BuildV2ColumnsOptsT> = {}): string[] {
  return buildV2Columns({ view: 'client', workshopVisible: true, stages: STAGES, ...extra })
    .map((column) => column.id)
    .filter((id): id is string => id != null)
}

describe('workshop columns', () => {
  it('renders nothing outside the warsztat list', () => {
    for (const id of workshopIds()) {
      // Closes the row and is not a data column — the ceiling does not apply to it.
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

  // The menu offers the workbench no axes, so a money axis or layer stored on a kosztorys must not
  // take a column away with nothing on screen to bring it back.
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

  // A problem engaged on the workbench still has to show the stawka that explains it.
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

  // The menu offers the workbench no netto/brutto axis, so netto is not „the axis that happens to
  // be on" — it is the only price a szablon can carry.
  // Brutto is netto times THIS investment's VAT, which a preset does not take to the next one.
  it('carries the netto price and no brutto beside it', () => {
    expect(workshopIds()).toContain('price')
    expect(workshopIds()).not.toContain('priceGross')
  })

  // Both halves per plane, because a source without its kwota is a control with no value on screen — and a stawka left off
  // this list would be missing from the plane the szablon opens on, while
  // `serializeKosztorysAsPreset` still carried it onto every budowa seeded from that szablon. Driven
  // off TOOL_PLANES, not `ALL_PLANE_PRICE_KEYS`, so a key dropped from the constant fails here
  // instead of quietly shrinking the loop.
  // Szablony are where katalog prace get curated, so the comment the katalog holds on each one is
  // shown there too.
  it('shows the Komentarz do pracy', () => {
    expect(workshopIds()).toContain('workNote')
  })

  // A szablon is a list of katalog prace (EX-1017); a row's own Komentarz would be the one thing on
  // it the katalog does not own.
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

  // The grid runs `lockRows`, so the „Akcje" menu is the ONLY route to usuń / przesuń / wstaw
  // a pozycja. It is not a data column the szablon carries, so the allowlist — written as a list of
  // what travels to the next budowa — dropped it and left the warsztat a grid nobody could trim.
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
