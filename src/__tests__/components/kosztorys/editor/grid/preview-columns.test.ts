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

// The client-facing preview: which columns it renders, and what pins the price plane they compute at.
// Asserted on rendered ids rather than on the constant, because the ids are the document a client
// reads — a constant can be right while the selection still drops half of it.

const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1', plane: null, split: null },
  { id: 9, ordinal: 2, label: 'Etap 2', plane: null, split: null },
]

const stageRow = (overrides: Parameters<typeof row>[0] = {}) =>
  row({ [stageKey(7)]: 0, [stageKey(9)]: 0, ...overrides })

function previewIds(extra: Partial<BuildV2ColumnsOptsT> = {}): string[] {
  return buildV2Columns({ view: 'client', previewVisible: true, stages: STAGES, ...extra })
    .map((column) => column.id)
    .filter((id): id is string => id != null)
}

describe('preview columns', () => {
  // The core of EX-591: each of these is ONE person's reading preference — the owner's picker, his
  // money axis, his layer — and none may shape a client's document. Each could individually take
  // something away: 'progress' stripped the whole offer, the axis stripped the stage amounts, the
  // picker hides stageValueGross by default. Here none of them changes anything.
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

  // The one gate a preview still answers to, because it is not a preference: `globalDiscount` belongs
  // to the investment, and while it is on the per-item rabat is bypassed, not cleared. Left in, the
  // offer would print a „Rabat" that no figure on the page reflects.
  it('drops the per-item rabat columns while a global discount overrides them', () => {
    const visible = previewIds({ globalDiscountActive: true })
    for (const id of ['discountType', 'discountValue', 'discountAmount']) {
      expect(previewIds()).toContain(id)
      expect(visible).not.toContain(id)
    }
  })

  // Owner, 2026-09-28: the value of the offered scope reads beside the quantity it prices. Each
  // Aktualizacja figure follows its ofertowy twin (EX-921).
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

  // The offer is quoted netto (owner, 2026-09-28): no gross figure reaches the investor's document.
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

  // The owner's stored order for this offer — distinct from the per-browser `columnRanks`, which the
  // first spec above already proves inert.
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

  it('withholds the owner-authored komentarz', () => {
    expect(previewIds()).not.toContain('note')
  })

  // What the sheet measured against what the etapy carry is the company's own bookkeeping, and the
  // payload DOES carry the reference figure (preview-kosztorys.ts ships the whole tree by decision),
  // so the render is the gate. „Pomiar (razem etapy)" is the one client-visible column derived from
  // the same rows, and the client still needs that column itself — so the render gate is what keeps
  // the sheet figure off it.
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

  // Keyed by toggleKey like every other gate, so one stored key takes the whole per-etap family —
  // hiding „Wartość netto" for etap 1 only would print a grid whose columns disagree per etap.
  it('takes a per-etap family whole, from its group key', () => {
    const visible = previewIds({ documentHiddenColumns: new Set(['stageValueNet']) })

    expect(visible).not.toContain('stageValueNet_7')
    expect(visible).not.toContain('stageValueNet_9')
    expect(visible).toContain('stage_7')
  })

  // The per-etap group key would take every etap with the empty one; an etap with no entries goes alone.
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
    // `note` is inert here rather than a way in — naming it is the point of the fixture.
    expect(previewIds({ documentHiddenColumns: new Set(['note']) })).not.toContain('note')
  })

  it('ignores the hidden set outside the preview', () => {
    const editorIds = buildV2Columns({
      view: 'client',
      stages: STAGES,
      documentHiddenColumns: new Set(['unit']),
    }).map((column) => column.id)

    expect(editorIds).toContain('unit')
  })

  // The picker is the preference selectV2Columns just stopped honouring, so a preview must not carry
  // one — an allowlist-filtered list would describe a grid whose columns no longer answer to it.
  it('offers no column picker', () => {
    const { columnToggleItems } = buildV2Grid({
      view: 'client',
      previewVisible: true,
      stages: STAGES,
    })
    expect(columnToggleItems).toEqual([])
  })
})

// The allowlist alone is not a lock for the CLIENT-named columns: `price`/`net`/`gross` are on it and
// would compute at a
// subcontractor's cost basis, under client column names. No column looks foreign, so the leak does not
// announce itself — which is why the pair is enforced by an exception rather than a comment.
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

  // For „Cena j.m." the allowlist is the ONLY half holding it back: a crew's stawka is assembled in
  // every view since the owner asked to compare both planes from „Inwestor", so the client view
  // reaches it too and only its absence from PREVIEW_VISIBLE_COLUMNS keeps it off a client's
  // document. „Źródło" and „Mnożnik" have both halves again — neither is assembled at the client
  // plane at all.
  it('cannot reach the subcontractor rate columns, in either plane', () => {
    const visible = previewIds()
    for (const plane of ['w_tools', 'own_tools'] as const) {
      for (const base of ['priceMode', 'priceCoeff', 'price'] as const) {
        expect(visible).not.toContain(planePriceKey(base, plane))
      }
    }
    // The editor gets the rate in the client view too, which is exactly why the allowlist is
    // load-bearing.
    const editorIds = buildV2Columns({ view: 'client', stages: STAGES, crewAxis: 'both' }).map(
      (c) => c.id,
    )
    expect(editorIds).toContain(planePriceKey('price', 'w_tools'))
    expect(editorIds).toContain(planePriceKey('price', 'own_tools'))
  })

  // The subcontractor plane without the allowlist is just the owner's own view — the pair binds one
  // way only, otherwise the assertion would lock the editor out.
  it('does not throw on the subcontractor plane alone', () => {
    expect(() => buildV2Columns({ view: 'w_tools', stages: STAGES })).not.toThrow()
  })
})
