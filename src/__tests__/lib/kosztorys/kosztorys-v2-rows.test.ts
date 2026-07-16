import { describe, expect, it } from 'vitest'
import { treeToRows, diffRow } from '@/lib/kosztorys/v2-rows'
import { filterRows, sortRows } from '@/lib/kosztorys/row-view'
import {
  rowTotalQtyDone,
  rowValueForView,
  rowRemainingForView,
  hasStagesOverPlanned,
  sectionSubtotalsForView,
} from '@/lib/kosztorys/settlement'
import { revertField } from '@/lib/kosztorys/row-ops'
import {
  planItemRemoval,
  REMOVE_BLOCK_LAST_ITEM,
  REMOVE_BLOCK_POPULATED,
} from '@/lib/kosztorys/delete-policy'
import { rowDoneFraction } from '@/lib/kosztorys/calc'
import {
  STAGE_QTY_PREFIX,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  stageKey,
  stageValueGrossKey,
  stageValueNetKey,
} from '@/lib/kosztorys/constants'
import type { KosztorysStageT, KosztorysTreeT, KosztorysV2RowT } from '@/types/kosztorys'

const baseItem = {
  id: 1,
  sectionId: 10,
  displayOrder: 0,
  description: 'Malowanie',
  unit: 'm2',
  plannedQty: 5,
  discountType: null,
  discountValue: 0,
  clientPrice: 20,
  // 'amount' override (flat 12/10) — preserves the test values from before the migration.
  wToolsOverrideType: 'amount' as const,
  wToolsOverrideValue: 12,
  ownToolsOverrideType: 'amount' as const,
  ownToolsOverrideValue: 10,
  costVariant: null,
  hiddenInExport: false,
  note: null,
}

const tree: KosztorysTreeT = {
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      defaultCostVariant: 'w_tools',
      wToolsCoeff: null,
      ownToolsCoeff: null,
      items: [baseItem],
    },
  ],
  stages: [
    { id: 100, ordinal: 1, label: null },
    { id: 101, ordinal: 2, label: null },
  ],
  progress: [{ itemId: 1, stageId: 100, qtyDone: 2 }],
  globalCoeffs: { wTools: 0.65, ownTools: 0.55 },
  vatRate: 0.08,
  globalDiscount: { type: null, value: 0 },
  revision: '2026-01-01T00:00:00.000Z',
}

describe('treeToRows', () => {
  it('spłaszcza pozycję z sekcją i etapami', () => {
    const rows = treeToRows(tree)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 1,
      sectionId: 10,
      sectionName: 'Sekcja A',
      vatRate: 0.08,
      description: 'Malowanie',
    })
    expect(rows[0][stageKey(100)]).toBe(2)
    expect(rows[0][stageKey(101)]).toBe(0) // no progress → 0
  })
})

describe('diffRow', () => {
  it('wykrywa zmianę pola pozycji', () => {
    const [prev] = treeToRows(tree)
    const next = { ...prev, plannedQty: 8 }
    expect(diffRow(prev, next)).toEqual({ itemPatch: { plannedQty: 8 } })
  })

  it('wykrywa zmianę ilości etapu', () => {
    const [prev] = treeToRows(tree)
    const next = { ...prev, [stageKey(101)]: 3 }
    expect(diffRow(prev, next)).toEqual({ stageChanges: [{ stageId: 101, qty: 3 }] })
  })

  it('bez zmian → pusty diff', () => {
    const [prev] = treeToRows(tree)
    expect(diffRow(prev, { ...prev })).toEqual({})
  })

  // diffRow klasyfikuje KAŻDY klucz wiersza po prefiksie ilości, bez białej listy. Gdyby któryś
  // namespace kwotowy zaczynał się od tamtego (albo odwrotnie), kolumna kwotowa trafiłaby tu jako
  // postęp etapu i poszłaby do zapisu jako Number('ValueNet_7') → NaN na nieistniejący etap.
  it('nie bierze kolumn kwotowych za postęp etapu', () => {
    const [prev] = treeToRows(tree)
    const next = { ...prev, [stageValueNetKey(101)]: 999, [stageValueGrossKey(101)]: 999 }
    expect(diffRow(prev, next)).toEqual({})
  })

  it('prefiksy etapowe są parami rozłączne', () => {
    const prefixes = [
      STAGE_QTY_PREFIX,
      STAGE_VALUE_NET_COLUMN_GROUP,
      STAGE_VALUE_GROSS_COLUMN_GROUP,
    ]
    for (const a of prefixes) {
      for (const b of prefixes) {
        if (a !== b) expect(a.startsWith(b)).toBe(false)
      }
    }
  })
})

describe('filterRows', () => {
  const rows = treeToRows({
    ...tree,
    sections: [
      {
        ...tree.sections[0],
        items: [
          { ...baseItem, id: 1, description: 'Malowanie ścian', unit: 'm2' },
          { ...baseItem, id: 2, description: 'Gładź gipsowa', unit: 'm2' },
          { ...baseItem, id: 3, description: 'Demontaż', unit: 'szt' },
        ],
      },
    ],
  })

  it('pusty filtr → wszystkie wiersze', () => {
    expect(filterRows(rows, '')).toHaveLength(3)
    expect(filterRows(rows, '   ')).toHaveLength(3)
  })

  it('filtruje po opisie (case-insensitive)', () => {
    expect(filterRows(rows, 'malow').map((r) => r.id)).toEqual([1])
  })

  it('filtruje po sekcji i j.m.', () => {
    expect(filterRows(rows, 'sekcja a')).toHaveLength(3)
    expect(filterRows(rows, 'szt').map((r) => r.id)).toEqual([3])
  })
})

describe('sortRows', () => {
  const rows: KosztorysV2RowT[] = [
    { id: 1, plannedQty: 3 } as KosztorysV2RowT,
    { id: 2, plannedQty: 1 } as KosztorysV2RowT,
    { id: 3, plannedQty: 2 } as KosztorysV2RowT,
  ]
  const get = (r: KosztorysV2RowT) => r.plannedQty

  it('asc / desc', () => {
    expect(sortRows(rows, get, 'asc').map((r) => r.id)).toEqual([2, 3, 1])
    expect(sortRows(rows, get, 'desc').map((r) => r.id)).toEqual([1, 3, 2])
  })

  it('nie mutuje wejścia', () => {
    sortRows(rows, get, 'asc')
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3])
  })

  it('sortuje stringi lokalnie', () => {
    const strRows = [
      { id: 1, description: 'Łaty' } as KosztorysV2RowT,
      { id: 2, description: 'Aaa' } as KosztorysV2RowT,
    ]
    expect(sortRows(strRows, (r) => r.description ?? '', 'asc').map((r) => r.id)).toEqual([2, 1])
  })

  // „Pozostało" bez Przedmiaru to null → w UI kreska. W gałęzi numerycznej null sortowałby się jak 0,
  // czyli kreska udawałaby wiersz domknięty. Kreska nie ma miejsca w porządku, więc idzie na koniec —
  // w OBU kierunkach, inaczej „desc" wypycha ją na samą górę.
  it('null zawsze na końcu, niezależnie od kierunku', () => {
    const withNulls: KosztorysV2RowT[] = [
      { id: 1, plannedQty: 3 } as KosztorysV2RowT,
      { id: 2, plannedQty: null } as unknown as KosztorysV2RowT,
      { id: 3, plannedQty: 1 } as KosztorysV2RowT,
    ]
    const key = (r: KosztorysV2RowT) => r.plannedQty as number | null
    expect(sortRows(withNulls, key, 'asc').map((r) => r.id)).toEqual([3, 1, 2])
    expect(sortRows(withNulls, key, 'desc').map((r) => r.id)).toEqual([1, 3, 2])
  })
})

describe('rowTotalQtyDone', () => {
  it('sums the quantities across every stage of the row', () => {
    const [row] = treeToRows(tree) // stage 100 = 2, stage 101 = 0
    expect(rowTotalQtyDone(row, tree.stages)).toBe(2)
  })

  // A stage added after the row was built carries no key on it — without ?? 0 the sum would be NaN.
  it('counts a stage missing its key on the row as zero', () => {
    const [row] = treeToRows(tree)
    const withGhost = [...tree.stages, { id: 999, ordinal: 3, label: null }]
    expect(rowTotalQtyDone(row, withGhost)).toBe(2)
  })
})

// EX-494. The pomiar IS the stage sum (the sheet's O = SUM(D:M)), so the row's value can only ever
// be what the stages say. Everything below pins that rule at the layer that settles it.
describe('wartość wiersza idzie za etapami', () => {
  const stages: KosztorysStageT[] = [
    { id: 100, ordinal: 1, label: null },
    { id: 101, ordinal: 2, label: null },
  ]
  const row = (over: Partial<KosztorysV2RowT>) =>
    ({
      ...baseItem,
      id: 1,
      sectionId: 10,
      sectionName: 'Sekcja A',
      vatRate: 0.08,
      sectionDefaultCostVariant: 'w_tools',
      sectionWToolsCoeff: null,
      sectionOwnToolsCoeff: null,
      globalWToolsCoeff: 0.65,
      globalOwnToolsCoeff: 0.55,
      clientPrice: 100,
      discountType: null,
      discountValue: 0,
      [stageKey(100)]: 0,
      [stageKey(101)]: 0,
      ...over,
    }) as unknown as KosztorysV2RowT

  const measured = row({ [stageKey(100)]: 4 }) // 4 zrobione → 400 netto
  const blank = row({}) // zero etapów

  describe('rowValueForView', () => {
    it('wartość to suma etapów × cena, wg ceny widoku', () => {
      expect(rowValueForView(measured, stages, 'client')).toBe(400) // 4 × 100
      expect(rowValueForView(measured, stages, 'w_tools')).toBe(48) // flat 12 × 4
    })

    it('sumuje etapy, nie bierze tylko pierwszego', () => {
      const twoStages = row({ [stageKey(100)]: 4, [stageKey(101)]: 3 })
      expect(rowValueForView(twoStages, stages, 'client')).toBe(700)
    })

    it('brak etapów → zero', () => {
      expect(rowValueForView(blank, stages, 'client')).toBe(0)
    })

    // A flat 'amount' rabat subtracts a fixed PLN sum; at zero executed quantity there is nothing
    // for it to come off of, so the value is 0 — not −discountValue. Without the qty guard the row
    // reads negative and stops matching Σ stageValueForView (each of which is already 0 here).
    it('brak etapów przy rabacie kwotowym → zero, nie wartość ujemna', () => {
      const blankDiscounted = row({ discountType: 'amount', discountValue: 500 })
      expect(rowValueForView(blankDiscounted, stages, 'client')).toBe(0)
    })
  })

  // "Pozostało" anchors on the przedmiar — the offer — not on what was executed. Anchored on the
  // latter it would read value − value ≡ 0 on every row: the sheet's dead AF column. This is the one
  // place we knowingly break sheet parity, so the numbers below are the whole justification.
  describe('rowRemainingForView', () => {
    // Przedmiar 100, cena 50 → oferta 5000; etapy 95 → wykonane 4750.
    const offered = (over: Partial<KosztorysV2RowT> = {}) =>
      row({ plannedQty: 100, clientPrice: 50, [stageKey(100)]: 95, ...over })

    it('ile z oferty zostało', () => {
      expect(rowRemainingForView(offered(), stages, 'client')).toBe(250)
    })

    it('etapy ponad Przedmiar → ujemne, bez clampowania', () => {
      expect(rowRemainingForView(offered({ [stageKey(100)]: 105 }), stages, 'client')).toBe(-250)
    })

    // Bez Przedmiaru nie ma oferty, od której cokolwiek odejmować — 0 kłamałoby, że wiersz jest
    // domknięty. Wyczyszczona komórka zapisuje null, którego `=== 0` by nie złapał.
    it('brak Przedmiaru → null, nie zero', () => {
      expect(rowRemainingForView(offered({ plannedQty: 0 }), stages, 'client')).toBeNull()
      expect(
        rowRemainingForView(offered({ plannedQty: null as unknown as number }), stages, 'client'),
      ).toBeNull()
    })
  })

  // Most między dwoma algorytmami jednej historii postępu: komórka wiersza to ułamek ILOŚCI,
  // a licznik i sekcje to stosunek WARTOŚCI. Każdy był przypięty osobno, nic nie sprawdzało, że
  // po zsumowaniu się zgadzają — i dokładnie w tej szczelinie siedział błąd 150%.
  //
  // Fixture MUSI mieć Σ etapów ≠ Przedmiar w każdym wierszu: na kosztorysie domkniętym obie strony
  // czytają tę samą liczbę i test przechodzi, nawet gdy licznik dzieli przez samego siebie.
  describe('most: licznik „Wykonano" a wiersze siatki', () => {
    const rows = [
      row({ id: 1, plannedQty: 10, [stageKey(100)]: 5 }), // oferta 1000, wykonane 500
      row({ id: 2, sectionId: 20, plannedQty: 20, [stageKey(100)]: 5 }), // oferta 2000, wykonane 500
    ]

    it('licznik dzieli wykonane przez ofertę, nie przez samego siebie', () => {
      const subtotals = sectionSubtotalsForView(rows, stages, 'client')
      const doneNet = subtotals.reduce((sum, s) => sum + s.net, 0)
      const plannedNet = subtotals.reduce((sum, s) => sum + s.plannedNet, 0)
      expect(doneNet).toBe(1000)
      expect(plannedNet).toBe(3000)
      expect(doneNet / plannedNet).toBeCloseTo(1 / 3, 10)
    })

    it('procent wiersza i procent kosztorysu opowiadają tę samą historię', () => {
      const subtotals = sectionSubtotalsForView([rows[0]], stages, 'client')
      expect(subtotals[0].net / subtotals[0].plannedNet).toBeCloseTo(
        rowDoneFraction(rows[0], rowTotalQtyDone(rows[0], stages)) as number,
        10,
      )
    })

    it('sekcja bez ani jednego etapu nie ma udziału w wykonaniu, ale ma ofertę', () => {
      const [section] = sectionSubtotalsForView([row({ plannedQty: 10 })], stages, 'client')
      expect(section.net).toBe(0)
      expect(section.plannedNet).toBe(1000)
    })
  })

  // Section subtotals sum row VALUES, which since EX-489 depend on the stages — so this lives here,
  // not in the purely price-based calc.ts.
  describe('sectionSubtotalsForView', () => {
    // A computed stage key next to a string field widens the literal's index signature to
    // `string | number`, which no longer satisfies KosztorysV2RowT — spread it in separately.
    const done = (qty: number) => ({ [stageKey(100)]: qty })
    const subtotalRows = [
      row({ id: 1, clientPrice: 20, ...done(10) }), // 10 × 20 = 200
      row({
        id: 2,
        clientPrice: 10,
        discountType: 'percent',
        discountValue: 20,
        ...done(5), // 5 × 10 = 50 − 20% = 40
      }),
      row({ id: 3, sectionId: 20, sectionName: 'Sekcja B', clientPrice: 100, ...done(10) }), // 10 × 100 = 1000
    ]

    it('sumuje netto per sekcja, nie miesza sekcji', () => {
      const subtotals = sectionSubtotalsForView(subtotalRows, stages, 'client')
      expect(subtotals.map((s) => [s.sectionId, s.net, s.itemCount])).toEqual([
        [10, 240, 2],
        [20, 1000, 1],
      ])
    })

    // Arkusz trzyma S456 i T456 równolegle — oferta i wykonanie to dwie figury, nie wybór.
    it('niesie ofertę sekcji obok wykonania', () => {
      const subtotals = sectionSubtotalsForView(subtotalRows, stages, 'client')
      // Przedmiar 5 z baseItem: 5 × 20 = 100; 5 × 10 = 50 − 20% = 40 (rabat w kwocie) → 140. Sekcja B: 5 × 100 = 500.
      expect(subtotals.map((s) => s.plannedNet)).toEqual([140, 500])
    })

    it('view-awareness: w_tools daje inne netto', () => {
      const subtotals = sectionSubtotalsForView(subtotalRows, stages, 'w_tools')
      expect(subtotals[0].net).toBe(168) // 10×12=120; 5×12=60 −20% = 48
      expect(subtotals[1].net).toBe(120)
    })

    it('share sumuje do ~1 gdy grandNet > 0', () => {
      const subtotals = sectionSubtotalsForView(subtotalRows, stages, 'client')
      expect(subtotals.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 10)
      expect(subtotals[1].share).toBeCloseTo(1000 / 1240, 10)
    })

    it('guard: grandNet = 0 → share 0, bez NaN', () => {
      const zero = subtotalRows.map((r) => ({ ...r, clientPrice: 0 }))
      expect(sectionSubtotalsForView(zero, stages, 'client').every((s) => s.share === 0)).toBe(true)
    })
  })

  // Czerwień = „zrobiono więcej, niż oferowano". Wcześniej porównywała etapy z pomiarem — po EX-494
  // byłaby to liczba porównana sama ze sobą, czyli sygnał martwy PO CICHU.
  describe('hasStagesOverPlanned', () => {
    const offered = (over: Partial<KosztorysV2RowT> = {}) => row({ plannedQty: 10, ...over })

    it('robota w granicach Przedmiaru się nie świeci', () => {
      expect(hasStagesOverPlanned(offered({ [stageKey(100)]: 4 }), stages)).toBe(false)
      expect(hasStagesOverPlanned(offered({ [stageKey(100)]: 10 }), stages)).toBe(false)
    })

    it('etapy ponad Przedmiar → czerwień', () => {
      expect(hasStagesOverPlanned(offered({ [stageKey(100)]: 11 }), stages)).toBe(true)
    })

    // „Robota bez oferty" nie jest osobną gałęzią — to po prostu Przedmiar 0, czyli każdy etap go
    // przekracza. Wyczyszczona komórka zapisuje null, którego gałąź `> 0` musi złapać tak samo.
    it('robota bez Przedmiaru → czerwień', () => {
      expect(hasStagesOverPlanned(offered({ plannedQty: 0, [stageKey(100)]: 5 }), stages)).toBe(
        true,
      )
      expect(
        hasStagesOverPlanned(
          offered({ plannedQty: null as unknown as number, [stageKey(100)]: 5 }),
          stages,
        ),
      ).toBe(true)
    })

    it('pusty wiersz nie świeci się na czerwono', () => {
      expect(hasStagesOverPlanned(offered({ plannedQty: 0 }), stages)).toBe(false)
    })
  })
})

describe('planItemRemoval', () => {
  const stages = [{ id: 100, ordinal: 1, label: null }]
  const row = (id: number, sectionId: number, over: Partial<KosztorysV2RowT> = {}) =>
    ({ id, sectionId, [stageKey(100)]: 0, ...over }) as unknown as KosztorysV2RowT

  it('środek sekcji (sekcja ma >1 pozycję) → usuń pozycję', () => {
    const rows = [row(1, 10), row(2, 10), row(3, 20)]
    expect(planItemRemoval(rows, rows[0], stages)).toEqual({ kind: 'remove-item' })
  })

  it('ostatnia pozycja sekcji (są inne sekcje) → kaskadowo usuń sekcję', () => {
    const rows = [row(1, 10), row(2, 20)]
    expect(planItemRemoval(rows, rows[1], stages)).toEqual({ kind: 'cascade-section' })
  })

  it('ostatni wiersz całego kosztorysu → zablokowane (próg pustego arkusza)', () => {
    const rows = [row(1, 10)]
    expect(planItemRemoval(rows, rows[0], stages)).toEqual({
      kind: 'blocked',
      reason: REMOVE_BLOCK_LAST_ITEM,
    })
  })

  it('wiersz z postępem etapu → zablokowane', () => {
    const rows = [row(1, 10, { [stageKey(100)]: 2 }), row(2, 20)]
    expect(planItemRemoval(rows, rows[0], stages)).toEqual({
      kind: 'blocked',
      reason: REMOVE_BLOCK_POPULATED,
    })
  })

  it('próg pustego arkusza ma pierwszeństwo nad blokadą wypełnienia', () => {
    const rows = [row(1, 10, { [stageKey(100)]: 5 })]
    expect(planItemRemoval(rows, rows[0], stages)).toEqual({
      kind: 'blocked',
      reason: REMOVE_BLOCK_LAST_ITEM,
    })
  })
})

describe('revertField', () => {
  const rows: KosztorysV2RowT[] = [
    { id: 1, plannedQty: 8 } as KosztorysV2RowT,
    { id: 2, plannedQty: 3 } as KosztorysV2RowT,
  ]

  it('cofa pole do wartości sprzed edycji, gdy current === attempted', () => {
    const out = revertField(rows, 1, 'plannedQty', 5, 8) // 8 was entered, server rejected it → revert to 5
    expect(out[0].plannedQty).toBe(5)
    expect(out[1].plannedQty).toBe(3) // other row untouched
  })

  it('nie nadpisuje świeższej edycji (current !== attempted)', () => {
    const out = revertField(rows, 1, 'plannedQty', 5, 99) // since the error the user entered 8, not 99
    expect(out[0].plannedQty).toBe(8)
  })

  it('nie rusza wierszy o innym id', () => {
    const out = revertField(rows, 99, 'plannedQty', 0, 8)
    expect(out).toEqual(rows)
  })
})
