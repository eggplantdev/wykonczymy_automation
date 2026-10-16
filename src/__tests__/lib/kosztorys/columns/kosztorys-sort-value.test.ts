import { describe, expect, it } from 'vitest'
import { sortValueGetter, reconcileSort } from '@/lib/kosztorys/columns/sort-value'
import { sortRows } from '@/lib/kosztorys/row-view'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { baseItem, makeStage, makeTree } from '@/__tests__/helpers/kosztorys-tree'

// Two rows whose COMPUTED figures order differently from their raw fields, so a test that passes
// can only pass because the computed value was actually resolved — not because input order survived.
const tree: KosztorysTreeT = makeTree({
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      color: null,
      items: [
        {
          id: 1,
          sectionId: 10,
          displayOrder: 0,
          description: 'A',
          descriptionTranslations: {},
          unit: 'm2',
          plannedQty: 10,
          sheetMeasuredQty: null,
          discountType: 'percent',
          discountValue: 10,
          clientPrice: 100,
          wToolsOverrideValue: null,
          ownToolsOverrideValue: null,
          wToolsOverrideCoeff: null,
          ownToolsOverrideCoeff: null,
          note: null,
          catalogueItemId: null,
          currentPlannedQty: null,
          aiPlannedQty: null,
          changeReason: null,
          reviewStatus: null,
        },
        {
          id: 2,
          sectionId: 10,
          displayOrder: 1,
          description: 'B',
          descriptionTranslations: {},
          unit: 'm2',
          plannedQty: 2,
          sheetMeasuredQty: null,
          discountType: null,
          discountValue: 0,
          clientPrice: 50,
          wToolsOverrideValue: null,
          ownToolsOverrideValue: null,
          wToolsOverrideCoeff: null,
          ownToolsOverrideCoeff: null,
          note: null,
          catalogueItemId: null,
          currentPlannedQty: null,
          aiPlannedQty: null,
          changeReason: null,
          reviewStatus: null,
        },
      ],
    },
  ],
  stages: [makeStage({ id: 100, plane: null })],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 1 },
    { itemId: 2, stageId: 100, qtyDone: 8 },
  ],
})

const rows = treeToRows(tree)
const idsSortedBy = (field: string) =>
  sortRows(rows, sortValueGetter(field, 'client', tree.stages), 'desc').map((r) => r.id)

describe('sortValueGetter — computed money/percent columns actually sort (EX-487)', () => {
  it.each([
    ['net', [2, 1]], // executed value: B 400 > A 90
    ['gross', [2, 1]], // net × VAT — same order as net
    ['plannedNet', [1, 2]], // offer value: A 900 > B 100 — OPPOSITE of net, so raw fields can't fake it
    ['plannedGross', [1, 2]],
    ['priceGross', [1, 2]], // 100 vs 50 at the client price
    ['discountAmount', [1, 2]], // A carries a 10% rabat (10), B none (0)
    ['discountAmountGross', [1, 2]],
    ['remaining', [1, 2]], // A +810 left, B −300 (overshot the offer)
    ['remainingGross', [1, 2]],
    ['stageQtySum', [2, 1]], // Σ etapów: B 8 > A 1
    ['donePercent', [2, 1]], // B 400% > A 10%
  ])('sorts by %s → %j', (field, expected) => {
    expect(idsSortedBy(field)).toEqual(expected)
  })

  it('still sorts by a real row field (plannedQty)', () => {
    expect(idsSortedBy('plannedQty')).toEqual([1, 2]) // 10 > 2
  })
})

describe('reconcileSort — a sort whose column has left the grid is dropped (EX-486)', () => {
  const rendered = new Set(['net', 'remaining', 'plannedQty'])

  it('keeps a sort whose field still renders', () => {
    const sort = { field: 'net', dir: 'asc' as const }
    expect(reconcileSort(sort, rendered)).toBe(sort)
  })

  it('drops a sort whose field no longer renders (e.g. remainingGross after the Netto axis toggle)', () => {
    expect(reconcileSort({ field: 'remainingGross', dir: 'desc' as const }, rendered)).toBeNull()
  })

  it('passes null through', () => {
    expect(reconcileSort(null, rendered)).toBeNull()
  })
})

// The subcontractor rows are deliberately ordered OPPOSITELY across the two planes — reading the
// wrong plane is the one mistake here that a same-order fixture would let pass.
const planeTree: KosztorysTreeT = makeTree({
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      color: null,
      items: [
        {
          ...baseItem,
          id: 1,
          description: 'A',
          plannedQty: 10,
          clientPrice: 100,
          discountType: 'amount',
          discountValue: 100,
          wToolsOverrideValue: null, // auto → 0.65
          ownToolsOverrideValue: 200,
          note: 'zzz',
        },
        {
          ...baseItem,
          id: 2,
          description: 'B',
          // A cleared numeric cell writes null through the grid's Column<number|null>, which the row
          // type still calls a number.
          plannedQty: null as unknown as number,
          clientPrice: 50,
          wToolsOverrideValue: 150,
          ownToolsOverrideValue: null, // auto → 0.55
        },
        {
          ...baseItem,
          id: 3,
          description: 'C',
          plannedQty: 9,
          clientPrice: 10,
          wToolsOverrideValue: 500,
          ownToolsOverrideValue: 400,
          note: 'aaa',
        },
      ],
    },
  ],
  stages: [makeStage({ id: 100 }), makeStage({ id: 200, ordinal: 2, plane: 'own_tools' })],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 1 },
    { itemId: 1, stageId: 200, qtyDone: 4 },
    { itemId: 2, stageId: 100, qtyDone: 6 },
    { itemId: 3, stageId: 100, qtyDone: 2 },
    { itemId: 3, stageId: 200, qtyDone: 2 },
  ],
})

const planeRows = treeToRows(planeTree)
const planeIdsSortedBy = (field: string, view: PriceViewT, dir: 'asc' | 'desc' = 'desc') =>
  sortRows(planeRows, sortValueGetter(field, view, planeTree.stages), dir).map((r) => r.id)
const planeRow = (id: number) => planeRows.find((r) => r.id === id)!

describe('sortValueGetter — the columns that used to opt out of sorting', () => {
  it('sorts by a stage qty column, which is a real row field', () => {
    expect(planeIdsSortedBy(stageKey(100), 'client')).toEqual([2, 3, 1]) // 6 > 2 > 1
  })

  it('sorts by a stage value column at the client price', () => {
    expect(sortValueGetter(stageValueNetKey(100), 'client', planeTree.stages)(planeRow(1))).toBe(80)
    expect(planeIdsSortedBy(stageValueNetKey(100), 'client')).toEqual([2, 1, 3]) // 300 > 80 > 20
  })

  it('prices a stage value column against the SUBCONTRACTOR plane, not the client one', () => {
    expect(planeIdsSortedBy(stageValueNetKey(100), 'w_tools')).toEqual([3, 2, 1]) // 1000 > 900 > 65
  })

  it('sorts a stage value brutto column like its netto twin', () => {
    expect(
      sortValueGetter(stageValueGrossKey(100), 'client', planeTree.stages)(planeRow(1)),
    ).toBeCloseTo(98.4)
    expect(planeIdsSortedBy(stageValueGrossKey(100), 'client')).toEqual([2, 1, 3])
  })

  it('has no value for an etap the plane does not price', () => {
    expect(
      sortValueGetter(stageValueNetKey(200), 'w_tools', planeTree.stages)(planeRow(1)),
    ).toBeNull()
  })

  it('has no value for an etap that is gone', () => {
    expect(
      sortValueGetter(stageValueNetKey(999), 'client', planeTree.stages)(planeRow(1)),
    ).toBeNull()
  })

  it('sorts „Źródło ceny" inherited → hand-overridden, per plane', () => {
    expect(planeIdsSortedBy(planePriceKey('priceMode', 'w_tools'), 'w_tools', 'asc')).toEqual([
      1, 2, 3,
    ]) // auto, kwota stała, kwota stała
    expect(planeIdsSortedBy(planePriceKey('priceMode', 'own_tools'), 'own_tools', 'asc')).toEqual([
      2, 1, 3,
    ])
  })

  it("sorts a crew's rate columns the same in every view, because the plane is in the id", () => {
    for (const plane of ['w_tools', 'own_tools'] as const) {
      for (const base of ['price', 'priceMode'] as const) {
        const field = planePriceKey(base, plane)
        expect(planeIdsSortedBy(field, 'client')).toEqual(planeIdsSortedBy(field, plane))
      }
    }
    // …and the two planes genuinely disagree, so the equality above is not two nulls matching.
    expect(planeIdsSortedBy(planePriceKey('price', 'w_tools'), 'client')).not.toEqual(
      planeIdsSortedBy(planePriceKey('price', 'own_tools'), 'client'),
    )
  })
})

// Trzy źródła na jednej płaszczyźnie, po jednym wierszu — fixture powyżej nie zna mnożnika, a
// dopisanie go tam poprzestawiałoby porządki, które tamte testy właśnie przypinają.
const sourceTree: KosztorysTreeT = makeTree({
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      color: null,
      items: [
        {
          ...baseItem,
          id: 1,
          description: 'auto',
          plannedQty: 1,
          clientPrice: 100,
          wToolsOverrideValue: null,
        },
        {
          ...baseItem,
          id: 2,
          description: 'mnożnik',
          plannedQty: 1,
          clientPrice: 100,
          wToolsOverrideValue: null,
          wToolsOverrideCoeff: 0.4,
        },
        {
          ...baseItem,
          id: 3,
          description: 'kwota',
          plannedQty: 1,
          clientPrice: 100,
          wToolsOverrideValue: 90,
        },
      ],
    },
  ],
  stages: [],
  progress: [],
})

const sourceRows = treeToRows(sourceTree)
const sourceIdsSortedBy = (field: string, dir: 'asc' | 'desc' = 'asc') =>
  sortRows(sourceRows, sortValueGetter(field, 'w_tools', sourceTree.stages), dir).map((r) => r.id)

describe('sortValueGetter — trzy źródła stawki wykonawcy', () => {
  it('sortuje „Źródło ceny" od współczynnika inwestycji ku zamrożonej kwocie', () => {
    expect(sourceIdsSortedBy(planePriceKey('priceMode', 'w_tools'))).toEqual([1, 2, 3])
  })

  it('sortuje „Mnożnik" po liczbie, którą widać w komórce — także mnożnik inwestycji', () => {
    expect(sourceIdsSortedBy(planePriceKey('priceCoeff', 'w_tools'), 'desc')).toEqual([1, 2, 3])
  })
})

describe('sortValueGetter — an empty cell is an absence, not a key', () => {
  it('sinks a commentless pozycja under both directions', () => {
    expect(planeIdsSortedBy('note', 'client', 'asc')).toEqual([3, 1, 2]) // aaa, zzz, (none)
    expect(planeIdsSortedBy('note', 'client', 'desc')).toEqual([1, 3, 2])
  })

  it('keeps a numeric column numeric when one of its cells is cleared', () => {
    expect(planeIdsSortedBy('plannedQty', 'client')).toEqual([1, 3, 2])
  })
})

// `planeTree` orders rows 1 and 3 oppositely at the client price and at a crew's stawka, and splits
// the pomiar across both crews' etapy, so a sort still reading the active view cannot pass.
describe('sortValueGetter — przedmiar figures sort by the client reading in every view (EX-894)', () => {
  const clientPinned = ['plannedNet', 'plannedGross', 'donePercent', 'remaining', 'remainingGross']

  it.each(['w_tools', 'own_tools'] as const)(
    '%s: each row keys on its client-view figure',
    (view) => {
      for (const field of clientPinned) {
        for (const row of planeRows) {
          expect(
            sortValueGetter(field, view, planeTree.stages)(row),
            `${field} #${row.id}`,
          ).toEqual(sortValueGetter(field, 'client', planeTree.stages)(row))
        }
      }
    },
  )

  it('orders „Wartość przedmiaru netto" and „% wykonania" as the client view does', () => {
    expect(planeIdsSortedBy('plannedNet', 'w_tools')).toEqual([1, 3, 2]) // 900 > 90 > 0
    expect(planeIdsSortedBy('donePercent', 'w_tools')).toEqual([1, 3, 2]) // 50% > 44% > —
  })
})
