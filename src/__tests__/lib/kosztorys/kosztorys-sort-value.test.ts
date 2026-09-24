import { describe, expect, it } from 'vitest'
import { columnSortValue, reconcileSort } from '@/lib/kosztorys/sort-value'
import { sortRows } from '@/lib/kosztorys/row-view'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'

// Two rows whose COMPUTED figures order differently from their raw fields, so a test that passes
// can only pass because the computed value was actually resolved — not because input order survived.
//
// Item 1 (id 1): big przedmiar, tiny stage sum, a 10% rabat → high plannedNet/remaining, low net.
// Item 2 (id 2): tiny przedmiar, stage sum OVER przedmiar, no rabat → high net, negative remaining.
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
        },
        {
          id: 2,
          sectionId: 10,
          displayOrder: 1,
          description: 'B',
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
        },
      ],
    },
  ],
  stages: [{ id: 100, ordinal: 1, label: null, plane: null, workerId: null }],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 1 },
    { itemId: 2, stageId: 100, qtyDone: 8 },
  ],
})

const rows = treeToRows(tree)
const idsSortedBy = (field: string) =>
  sortRows(rows, (r) => columnSortValue(r, field, 'client', tree.stages), 'desc').map((r) => r.id)

describe('columnSortValue — computed money/percent columns actually sort (EX-487)', () => {
  // Every one of these is a computed column, not a KosztorysV2RowT field: before the fix each
  // resolved to '' for all rows and the sort was a silent no-op, leaving input order [1, 2].
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

// A second fixture for the keys the EX-487 rows cannot reach: two PLANED etapy (the one above has
// `plane: null`, which belongs to neither subcontractor view), both źródła on both planes,
// a comment on some rows only, and a cleared „Przedmiar".
//
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
  stages: [
    { id: 100, ordinal: 1, label: null, plane: 'w_tools', workerId: null },
    { id: 200, ordinal: 2, label: null, plane: 'own_tools', workerId: null },
  ],
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
  sortRows(planeRows, (r) => columnSortValue(r, field, view, planeTree.stages), dir).map(
    (r) => r.id,
  )
const planeRow = (id: number) => planeRows.find((r) => r.id === id)!

describe('columnSortValue — the columns that used to opt out of sorting', () => {
  it('sorts by a stage qty column, which is a real row field', () => {
    expect(planeIdsSortedBy(stageKey(100), 'client')).toEqual([2, 3, 1]) // 6 > 2 > 1
  })

  it('sorts by a stage value column at the client price', () => {
    // Every etap counts in the client view, so the denominator is 5/6/4 — A's „amount" rabat is
    // spread across its etapy, not charged to each.
    expect(columnSortValue(planeRow(1), stageValueNetKey(100), 'client', planeTree.stages)).toBe(80)
    expect(planeIdsSortedBy(stageValueNetKey(100), 'client')).toEqual([2, 1, 3]) // 300 > 80 > 20
  })

  it('prices a stage value column against the SUBCONTRACTOR plane, not the client one', () => {
    // In `w_tools` only etap 100 is that crew's, so both the price and the denominator change —
    // which flips the order the client view gives.
    expect(planeIdsSortedBy(stageValueNetKey(100), 'w_tools')).toEqual([3, 2, 1]) // 1000 > 900 > 65
  })

  it('sorts a stage value brutto column like its netto twin', () => {
    expect(
      columnSortValue(planeRow(1), stageValueGrossKey(100), 'client', planeTree.stages),
    ).toBeCloseTo(98.4)
    expect(planeIdsSortedBy(stageValueGrossKey(100), 'client')).toEqual([2, 1, 3])
  })

  it('has no value for an etap the plane does not price', () => {
    // Etap 200 is own_tools: in `w_tools` its column is not assembled at all, and its wartość is not
    // this crew's to sort by — the same „—" answer as an etap that no longer exists.
    expect(
      columnSortValue(planeRow(1), stageValueNetKey(200), 'w_tools', planeTree.stages),
    ).toBeNull()
  })

  it('has no value for an etap that is gone', () => {
    expect(
      columnSortValue(planeRow(1), stageValueNetKey(999), 'client', planeTree.stages),
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

  // The whole point of assembling both planes: the two crews' rates readable side by side in the
  // widok Inwestora. The id decides which plane a rate column speaks for, not the active view, so
  // each column sorts identically whichever view it is read from.
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
  sortRows(sourceRows, (r) => columnSortValue(r, field, 'w_tools', sourceTree.stages), dir).map(
    (r) => r.id,
  )

describe('columnSortValue — trzy źródła stawki wykonawcy', () => {
  it('sortuje „Źródło ceny" od współczynnika inwestycji ku zamrożonej kwocie', () => {
    expect(sourceIdsSortedBy(planePriceKey('priceMode', 'w_tools'))).toEqual([1, 2, 3])
  })

  it('sortuje „Mnożnik" po liczbie, którą widać w komórce — także mnożnik inwestycji', () => {
    // Malejąco, bo to kierunek, w którym „brak" musi wylądować na dole mimo braku liczby. Wiersz
    // „auto" pokazuje mnożnik inwestycji (0,65) i sortuje się nad własnym 0,4 — sortowanie po
    // samym własnym mnożniku wpychało go pod niego.
    expect(sourceIdsSortedBy(planePriceKey('priceCoeff', 'w_tools'), 'desc')).toEqual([1, 2, 3])
  })
})

describe('columnSortValue — an empty cell is an absence, not a key', () => {
  it('sinks a commentless pozycja under both directions', () => {
    expect(planeIdsSortedBy('note', 'client', 'asc')).toEqual([3, 1, 2]) // aaa, zzz, (none)
    expect(planeIdsSortedBy('note', 'client', 'desc')).toEqual([1, 3, 2])
  })

  it('keeps a numeric column numeric when one of its cells is cleared', () => {
    // With `?? ''` the empty cell put a string next to numbers, dropping the WHOLE column into
    // localeCompare — „9" then sorted above „10".
    expect(planeIdsSortedBy('plannedQty', 'client')).toEqual([1, 3, 2])
  })
})
