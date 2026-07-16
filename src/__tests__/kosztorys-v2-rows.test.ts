import { describe, expect, it } from 'vitest'
import {
  treeToRows,
  diffRow,
  stageKey,
  filterRows,
  sortRows,
  rowTotalQtyDone,
  rowValueForView,
  rowRemainingForView,
  hasMeasurementMismatch,
  kosztorysDoneNetForView,
  sectionDoneNetForView,
  sectionSubtotalsForView,
  revertField,
  planItemRemoval,
  REMOVE_BLOCK_LAST_ITEM,
  REMOVE_BLOCK_POPULATED,
} from '@/lib/kosztorys/v2-rows'
import {
  STAGE_QTY_PREFIX,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
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
  measuredQty: 5,
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
    { id: 1, measuredQty: 3 } as KosztorysV2RowT,
    { id: 2, measuredQty: 1 } as KosztorysV2RowT,
    { id: 3, measuredQty: 2 } as KosztorysV2RowT,
  ]
  const get = (r: KosztorysV2RowT) => r.measuredQty

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

describe('kosztorysDoneNetForView / sectionDoneNetForView', () => {
  const stages: KosztorysStageT[] = [{ id: 100, ordinal: 1, label: null }]
  // measuredQty 10 × price 20 = 200 net; qtyDone set per row
  const row = (id: number, sectionId: number, qtyDone: number) =>
    ({
      ...baseItem,
      id,
      sectionId,
      measuredQty: 10,
      [stageKey(100)]: qtyDone,
    }) as unknown as KosztorysV2RowT

  const rows = [row(1, 10, 5), row(2, 10, 10), row(3, 20, 0)]

  it('sums the whole kosztorys done value at the view price', () => {
    expect(kosztorysDoneNetForView(rows, stages, 'client')).toBe(300) // 100 + 200 + 0
    expect(kosztorysDoneNetForView(rows, stages, 'w_tools')).toBe(180) // price 12: 60 + 120 + 0
  })

  it('groups the done value by section', () => {
    const bySection = sectionDoneNetForView(rows, stages, 'client')
    expect(bySection.get(10)).toBe(300)
    expect(bySection.get(20)).toBe(0)
  })

  it('empty kosztorys → zero and an empty map', () => {
    expect(kosztorysDoneNetForView([], stages, 'client')).toBe(0)
    expect(sectionDoneNetForView([], stages, 'client').size).toBe(0)
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
      measuredQty: 10,
      discountType: null,
      discountValue: 0,
      [stageKey(100)]: 0,
      [stageKey(101)]: 0,
      ...over,
    }) as unknown as KosztorysV2RowT

  const measured = row({ [stageKey(100)]: 4 }) // 4 zrobione → 400 netto
  const unmeasured = row({ measuredQty: 0, [stageKey(100)]: 5 }) // 5 zrobione → 500 netto
  const blank = row({ measuredQty: 0 }) // zero etapów

  // Scaffolding: the field can still hold a stale number until phase 4 drops the column, so the rule
  // "pomiar IS Σ stages" has to be asserted against a row where the two openly contradict. Once the
  // field is gone the type carries this and the test goes with it.
  it('wartość idzie za etapami nawet gdy pole pomiaru im przeczy', () => {
    const conflicting = row({ plannedQty: 10, measuredQty: 999, [stageKey(100)]: 4 })
    expect(rowValueForView(conflicting, stages, 'client')).toBe(400)
  })

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
  })

  // Both terms of "Pozostało" are the same figure until phase 2 anchors it on the przedmiar — the
  // sheet's dead AF column, reproduced. Pinned so the re-anchoring is a visible transition.
  describe('rowRemainingForView — skamielina do fazy 2', () => {
    it('kotwica w wykonaniu daje zero na każdym wierszu', () => {
      expect(rowRemainingForView(measured, stages, 'client')).toBe(0)
      expect(rowRemainingForView(row({ [stageKey(100)]: 13 }), stages, 'client')).toBe(0)
    })
  })

  // Most między dwoma algorytmami jednej historii postępu: komórka wiersza to ułamek ILOŚCI,
  // a licznik i sekcje to stosunek WARTOŚCI. Każdy był przypięty osobno, nic nie sprawdzało, że
  // po zsumowaniu się zgadzają — i dokładnie w tej szczelinie siedział błąd 150%.
  describe('most: licznik „Wykonano" a wiersze siatki', () => {
    const rows = [unmeasured, row({ id: 2, sectionId: 20, [stageKey(100)]: 10 })]

    it('kosztorys zrobiony w całości czyta 100%, nie 150%', () => {
      const doneNet = kosztorysDoneNetForView(rows, stages, 'client')
      const totalNet = sectionSubtotalsForView(rows, stages, 'client').reduce(
        (s, x) => s + x.net,
        0,
      )
      expect(doneNet).toBe(1500) // 500 + 1000
      expect(totalNet).toBe(1500)
      expect(doneNet / totalNet).toBe(1)
    })

    it('procent sekcji nigdy nie przebija 100% na wierszach bez nadmiaru', () => {
      const done = sectionDoneNetForView(rows, stages, 'client')
      for (const section of sectionSubtotalsForView(rows, stages, 'client')) {
        expect((done.get(section.sectionId) ?? 0) / section.net).toBeLessThanOrEqual(1)
      }
    })

    it('sekcja z jednym wierszem ma cały udział, nie „—"', () => {
      const [section] = sectionSubtotalsForView([unmeasured], stages, 'client')
      expect(section.net).toBe(500)
      expect(section.share).toBe(1)
    })
  })

  // Przeniesione z kosztorys-calc.test.ts razem z funkcją: podsumowanie sekcji sumuje WARTOŚCI
  // wierszy, a te od EX-489 zależą od etapów — więc nie mieszka już w czysto cenowym calc.ts.
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

  describe('hasMeasurementMismatch', () => {
    it('częściowo zrobiony wiersz to normalna praca w toku, nie rozjazd', () => {
      expect(hasMeasurementMismatch(measured, stages)).toBe(false)
      expect(hasMeasurementMismatch(row({ [stageKey(100)]: 10 }), stages)).toBe(false)
    })

    it('etapy ponad pomiar → rozjazd', () => {
      expect(hasMeasurementMismatch(row({ [stageKey(100)]: 11 }), stages)).toBe(true)
    })

    it('praca bez pomiaru → rozjazd', () => {
      expect(hasMeasurementMismatch(unmeasured, stages)).toBe(true)
    })

    it('pusty wiersz nie świeci się na czerwono', () => {
      expect(hasMeasurementMismatch(blank, stages)).toBe(false)
    })

    // Wyczyszczenie komórki Pomiar zapisuje null (grid: Column<number|null>), nie 0.
    it('wyczyszczony pomiar zachowuje się jak brak pomiaru', () => {
      const cleared = row({ measuredQty: null as unknown as number, [stageKey(100)]: 5 })
      expect(hasMeasurementMismatch(cleared, stages)).toBe(true)
      expect(rowValueForView(cleared, stages, 'client')).toBe(500)
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

  // Postęp etapu to jedyne, co „wypełnia" wiersz — zostawiona liczba w pomiarze nie może go
  // zamurować, bo nikt jej już nie wpisuje ani nie wyczyści.
  it('wiersz z samą starą liczbą w pomiarze → usuwalny', () => {
    const rows = [row(1, 10, { measuredQty: 3 }), row(2, 10), row(3, 20)]
    expect(planItemRemoval(rows, rows[0], stages)).toEqual({ kind: 'remove-item' })
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
    { id: 1, measuredQty: 8 } as KosztorysV2RowT,
    { id: 2, measuredQty: 3 } as KosztorysV2RowT,
  ]

  it('cofa pole do wartości sprzed edycji, gdy current === attempted', () => {
    const out = revertField(rows, 1, 'measuredQty', 5, 8) // 8 was entered, server rejected it → revert to 5
    expect(out[0].measuredQty).toBe(5)
    expect(out[1].measuredQty).toBe(3) // other row untouched
  })

  it('nie nadpisuje świeższej edycji (current !== attempted)', () => {
    const out = revertField(rows, 1, 'measuredQty', 5, 99) // since the error the user entered 8, not 99
    expect(out[0].measuredQty).toBe(8)
  })

  it('nie rusza wierszy o innym id', () => {
    const out = revertField(rows, 99, 'measuredQty', 0, 8)
    expect(out).toEqual(rows)
  })
})
