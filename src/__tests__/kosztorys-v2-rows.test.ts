import { describe, expect, it } from 'vitest'
import { treeToRows, diffRow, stageKey } from '@/lib/kosztorys/v2-rows'
import type { KosztorysTreeT } from '@/types/kosztorys'

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
  subcontractorWToolsPrice: 12,
  subcontractorOwnToolsPrice: 10,
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
      items: [baseItem],
    },
  ],
  stages: [
    { id: 100, ordinal: 1, label: null },
    { id: 101, ordinal: 2, label: null },
  ],
  progress: [{ itemId: 1, stageId: 100, qtyDone: 2 }],
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
