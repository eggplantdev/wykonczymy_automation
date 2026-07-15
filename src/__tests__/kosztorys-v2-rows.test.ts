import { describe, expect, it } from 'vitest'
import {
  treeToRows,
  diffRow,
  stageKey,
  filterRows,
  sortRows,
  rowDoneNetForView,
  rowTotalQtyDone,
  kosztorysDoneNetForView,
  sectionDoneNetForView,
  revertField,
  planItemRemoval,
  REMOVE_BLOCK_LAST_ITEM,
  REMOVE_BLOCK_POPULATED,
} from '@/lib/kosztorys/v2-rows'
import { rowNetForView } from '@/lib/kosztorys/calc'
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
    const next = { ...prev, measuredQty: 8 }
    expect(diffRow(prev, next)).toEqual({ itemPatch: { measuredQty: 8 } })
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

describe('rowNetForView', () => {
  const item = {
    ...baseItem,
    measuredQty: 10,
    clientPrice: 20,
    discountType: null,
    discountValue: 0,
    sectionWToolsCoeff: null,
    sectionOwnToolsCoeff: null,
    globalWToolsCoeff: 0.65,
    globalOwnToolsCoeff: 0.55,
  }
  it('liczy netto wg ceny widoku', () => {
    expect(rowNetForView(item, 'client')).toBe(200)
    expect(rowNetForView(item, 'w_tools')).toBe(120)
    expect(rowNetForView(item, 'own_tools')).toBe(100)
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

describe('rowDoneNetForView', () => {
  it('sumuje wartości etapów wg ceny widoku', () => {
    const [row] = treeToRows(tree) // stage 100 qty=2, stage 101 qty=0; clientPrice 20
    expect(rowDoneNetForView(row, tree.stages, 'client')).toBe(40) // 2 × 20
    expect(rowDoneNetForView(row, tree.stages, 'w_tools')).toBe(24) // 2 × 12
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

describe('planItemRemoval', () => {
  const stages = [{ id: 100, ordinal: 1, label: null }]
  const row = (id: number, sectionId: number, over: Partial<KosztorysV2RowT> = {}) =>
    ({ id, sectionId, measuredQty: 0, [stageKey(100)]: 0, ...over }) as unknown as KosztorysV2RowT

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

  it('wiersz z pomiarem → zablokowane', () => {
    const rows = [row(1, 10, { measuredQty: 3 }), row(2, 20)]
    expect(planItemRemoval(rows, rows[0], stages)).toEqual({
      kind: 'blocked',
      reason: REMOVE_BLOCK_POPULATED,
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
    const rows = [row(1, 10, { measuredQty: 5 })]
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
