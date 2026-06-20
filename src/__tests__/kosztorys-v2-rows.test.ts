import { describe, expect, it } from 'vitest'
import {
  treeToRows,
  diffRow,
  stageKey,
  filterRows,
  sortRows,
  rowDoneNetForView,
  revertField,
} from '@/lib/kosztorys/v2-rows'
import { rowNetForView } from '@/lib/kosztorys/calc'
import { buildV2Columns } from '@/lib/tables/kosztorys-v2-columns'
import type { KosztorysTreeT, KosztorysV2RowT } from '@/types/kosztorys'

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
  // Override 'amount' (płaskie 12/10) — zachowuje wartości testów sprzed migracji.
  wToolsOverrideType: 'amount' as const,
  wToolsOverrideValue: 12,
  ownToolsOverrideType: 'amount' as const,
  ownToolsOverrideValue: 10,
  costVariant: null,
  vatRate: null,
  hiddenInExport: false,
  note: null,
}

const tree: KosztorysTreeT = {
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      vatRate: 0.08,
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
}

describe('treeToRows', () => {
  it('spłaszcza pozycję z sekcją i etapami', () => {
    const rows = treeToRows(tree)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 1,
      sectionId: 10,
      sectionName: 'Sekcja A',
      sectionVatRate: 0.08,
      description: 'Malowanie',
    })
    expect(rows[0][stageKey(100)]).toBe(2)
    expect(rows[0][stageKey(101)]).toBe(0) // brak postępu → 0
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

describe('revertField', () => {
  const rows: KosztorysV2RowT[] = [
    { id: 1, measuredQty: 8 } as KosztorysV2RowT,
    { id: 2, measuredQty: 3 } as KosztorysV2RowT,
  ]

  it('cofa pole do wartości sprzed edycji, gdy current === attempted', () => {
    const out = revertField(rows, 1, 'measuredQty', 5, 8) // wpisano 8, serwer odrzucił → wróć do 5
    expect(out[0].measuredQty).toBe(5)
    expect(out[1].measuredQty).toBe(3) // inny wiersz nietknięty
  })

  it('nie nadpisuje świeższej edycji (current !== attempted)', () => {
    const out = revertField(rows, 1, 'measuredQty', 5, 99) // od czasu błędu user wpisał 8, nie 99
    expect(out[0].measuredQty).toBe(8)
  })

  it('nie rusza wierszy o innym id', () => {
    const out = revertField(rows, 99, 'measuredQty', 0, 8)
    expect(out).toEqual(rows)
  })
})

describe('buildV2Columns', () => {
  it('dokłada jedną kolumnę na każdy etap', () => {
    const cols0 = buildV2Columns({ stages: [], view: 'client' })
    const cols2 = buildV2Columns({
      stages: [
        { id: 100, ordinal: 1, label: null },
        { id: 101, ordinal: 2, label: null },
      ],
      view: 'client',
    })
    expect(cols2.length - cols0.length).toBe(2)
  })
})
