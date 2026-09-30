import { describe, expect, it } from 'vitest'
import { buildV2Columns } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'

// An engaged etap problem narrows which etapy get columns — a reading gesture, not a data filter. What
// is asserted here is the narrowing itself: which etapy survive it, and that all three etap axes
// survive it identically (they are three renderings of one etap, so one drifting would show an etap's
// wartość beside no ilość to explain it).

const BARE: KosztorysStageT = { id: 7, ordinal: 1, label: 'Etap 1', plane: null, split: null }
const NO_WORKER: KosztorysStageT = {
  id: 9,
  ordinal: 2,
  label: 'Etap 2',
  plane: 'w_tools',
  split: null,
}
const FINE: KosztorysStageT = {
  id: 11,
  ordinal: 3,
  label: 'Etap 3',
  plane: 'w_tools',
  split: oneWorkerSplit(5),
}
const STAGES = [BARE, NO_WORKER, FINE]

const columnIds = (opts: Partial<BuildV2ColumnsOptsT> = {}) =>
  buildV2Columns({ view: 'client', stages: STAGES, ...opts })
    .map((column) => column.id)
    .filter((id): id is string => id != null)

// The etap ids each axis kept, read back off the column ids.
const stagesOnAxis = (ids: string[], keyFor: (stageId: number) => string): number[] =>
  STAGES.map((stage) => stage.id).filter((id) => ids.includes(keyFor(id)))

const axes = (opts: Partial<BuildV2ColumnsOptsT> = {}) => {
  const ids = columnIds(opts)
  return {
    qty: stagesOnAxis(ids, stageKey),
    net: stagesOnAxis(ids, stageValueNetKey),
    gross: stagesOnAxis(ids, stageValueGrossKey),
  }
}

describe('stage-column narrowing', () => {
  it('leaves every etap standing when no problem is engaged', () => {
    expect(axes()).toEqual({ qty: [7, 9, 11], net: [7, 9, 11], gross: [7, 9, 11] })
    expect(axes({ engagedStageConditionIds: [] })).toEqual({
      qty: [7, 9, 11],
      net: [7, 9, 11],
      gross: [7, 9, 11],
    })
  })

  it('keeps only the offending etapy, on all three axes at once', () => {
    expect(axes({ engagedStageConditionIds: ['stage-no-plane'] })).toEqual({
      qty: [7],
      net: [7],
      gross: [7],
    })
  })

  // Same OR semantics as the row diagnostics — and a bare etap answers to both conditions.
  it('unions two engaged problems rather than intersecting them', () => {
    expect(axes({ engagedStageConditionIds: ['stage-no-plane', 'stage-no-worker'] })).toEqual({
      qty: [7, 9],
      net: [7, 9],
      gross: [7, 9],
    })
  })

  // The view filter runs first: on a crew's plane the plane-less etap is already gone, so its filter
  // can only empty the block.
  it('narrows within the view’s own etapy, never past them', () => {
    expect(axes({ view: 'w_tools' })).toEqual({ qty: [9, 11], net: [9, 11], gross: [9, 11] })
    expect(axes({ view: 'w_tools', engagedStageConditionIds: ['stage-no-worker'] })).toEqual({
      qty: [9],
      net: [9],
      gross: [9],
    })
  })

  // A row problem narrows pozycje, not etapy — an id from the other registry must not reach in here.
  it('ignores an id that belongs to the row registry', () => {
    expect(axes({ engagedStageConditionIds: ['no-client-price'] })).toEqual({
      qty: [7, 9, 11],
      net: [7, 9, 11],
      gross: [7, 9, 11],
    })
  })
})

// The other half of the same gesture: a problem forces the column it is about past the picker, so
// „pokaż pozycje bez ceny j.m." can't land on a grid with „Cena j.m." switched off.
describe('column reveal', () => {
  const hiding = (...hidden: string[]) => ({ isHidden: (id: string) => hidden.includes(id) })

  it('overrides a stored hide tick only while the problem is engaged', () => {
    expect(columnIds(hiding('price'))).not.toContain('price')
    expect(columnIds({ ...hiding('price'), revealedColumnIds: new Set(['price']) })).toContain(
      'price',
    )
    // Disengaged, the tick is back in charge — nothing about the reveal was written down.
    expect(columnIds({ ...hiding('price'), revealedColumnIds: new Set() })).not.toContain('price')
  })

  it('leaves an unrevealed hidden column hidden', () => {
    const ids = columnIds({ ...hiding('price', 'unit'), revealedColumnIds: new Set(['price']) })
    expect(ids).toContain('price')
    expect(ids).not.toContain('unit')
  })

  // The reveal answers „may a stored tick hide this", not „which reading is on screen". Forcing a
  // brutto column onto someone reading netto would answer a question they had already answered.
  it('never overrides the money axis', () => {
    const ids = columnIds({ moneyAxis: 'net', revealedColumnIds: new Set(['gross']) })
    expect(ids).not.toContain('gross')
  })

  // A client's document answers to its own allowlist; an owner's gesture may not widen it.
  it('never widens a client preview', () => {
    const ids = columnIds({ previewVisible: true, revealedColumnIds: new Set(['priceMode']) })
    expect(ids).not.toContain('priceMode')
  })
})
