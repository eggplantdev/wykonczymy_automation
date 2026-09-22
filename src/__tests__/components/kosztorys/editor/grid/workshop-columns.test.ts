import { describe, expect, it } from 'vitest'
import {
  buildV2Columns,
  buildV2Grid,
} from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { WORKSHOP_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

// The szablon workbench narrows the grid to what a szablon actually carries. The assertions read
// the RENDERED ids rather than the constant — the constant can be right while the selection still
// lets a column through, or drops one.

const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1', plane: null, workerId: null },
]

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

  // Every reading preference — the picker tick, the money axis, the layer — persists per BROWSER
  // and arrives here having been set on some other kosztorys, while the workbench hides every
  // control that edits it. So each has to be a dead end in BOTH directions, and the floor is the
  // one that bites: „Sekcja" is in DEFAULT_HIDDEN_COLUMNS, so on a first visit it would simply be
  // missing from the owner's own list.
  it('is a ceiling no reading preference can lift', () => {
    expect(workshopIds({ isHidden: () => false, moneyAxis: 'both', layer: 'both' })).toEqual(
      workshopIds(),
    )
  })

  it('is a floor no reading preference can lower', () => {
    expect(workshopIds({ isHidden: () => true, moneyAxis: 'none', layer: 'none' })).toEqual(
      workshopIds(),
    )
  })

  // The third preference gate, and the one the allowlist cannot answer on its own: a rank map
  // reorders columns it is allowed to keep. Same localStorage, same missing control — the reorder
  // dialog and its reset both live in KosztorysViewMenu, which the workbench hides.
  it('ignores a stored column order set on some other kosztorys', () => {
    expect(workshopIds({ columnRanks: { note: 0, description: 1, sectionName: 2 } })).toEqual(
      workshopIds(),
    )
  })

  // The workbench has no axis switch, so netto is not „the axis that happens to be on" — it is the
  // only price a szablon can carry. Brutto is netto times THIS investment's VAT, which a preset
  // does not take to the next one.
  it('carries the netto price and no brutto beside it', () => {
    expect(workshopIds()).toContain('price')
    expect(workshopIds()).not.toContain('priceGross')
  })

  // „Źródło ceny wykonawcy" assembles only off the client plane everywhere else, and the workbench
  // IS pinned to the client plane — so this asserts the assembly exception, not just the allowlist.
  // One entry per plane: a szablon carries both crews' overrides.
  it('offers the price source for every crew plane', () => {
    for (const plane of TOOL_PLANES) {
      expect(workshopIds()).toContain(planePriceKey('priceMode', plane))
    }
  })

  // The mode is in the skeleton; the rate is a figure that starts hidden and has no picker here to
  // bring it back. Listing one without the other is the deliberate half.
  it('keeps the crew rates out, mode or no mode', () => {
    for (const plane of TOOL_PLANES) {
      expect(workshopIds()).not.toContain(planePriceKey('price', plane))
    }
  })

  // The exception is scoped to the workbench: the same client plane on an ordinary kosztorys, and
  // the client preview built on it, must still assemble no edit control for a contractor's rate.
  it('does not leak the price source onto an ordinary client view', () => {
    const ordinary = buildV2Columns({ view: 'client', stages: STAGES })
      .map((column) => column.id)
      .filter((id): id is string => id != null)

    for (const plane of TOOL_PLANES) {
      expect(ordinary).not.toContain(planePriceKey('priceMode', plane))
    }
  })

  // The grid runs `lockRows`, so the „Akcje" menu is the ONLY route to usuń / przesuń / wstaw
  // a pozycja. It is not a data column the szablon carries, so the allowlist — written as a list of
  // what travels to the next budowa — dropped it and left the warsztat a grid nobody could trim.
  it('keeps the row-actions column, the only route to delete or move a pozycja', () => {
    expect(workshopIds({ onRemoveItem: () => {}, onReorderItem: () => {} })).toContain('actions')
  })

  it('leaves the picker empty, so the toolbar has nothing to offer', () => {
    const { columnToggleItems } = buildV2Grid({
      view: 'client',
      workshopVisible: true,
      stages: STAGES,
    })

    expect(columnToggleItems).toEqual([])
  })

  it('narrows nothing on an ordinary kosztorys', () => {
    const ordinary = buildV2Columns({ view: 'client', stages: STAGES })
      .map((column) => column.id)
      .filter((id): id is string => id != null)

    expect(ordinary).toContain('plannedQty')
    expect(ordinary).toContain('net')
  })
})
