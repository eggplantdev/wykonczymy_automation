import { describe, expect, it } from 'vitest'
import { columnValueResolver } from '@/lib/kosztorys/columns/column-values'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'

// One row, work split across both crews' etapy: przedmiar 10 at 100 zł, stawki 65 (auto) and 200.
const tree: KosztorysTreeT = makeTree({
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
          wToolsOverrideValue: null,
          ownToolsOverrideValue: 200,
        },
      ],
    },
  ],
  stages: [
    { id: 100, ordinal: 1, label: null, plane: 'w_tools', split: null },
    { id: 200, ordinal: 2, label: null, plane: 'own_tools', split: null },
  ],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 1 },
    { itemId: 1, stageId: 200, qtyDone: 4 },
  ],
})
const [row] = treeToRows(tree)
const { stages } = tree

describe('columnValueResolver', () => {
  it('reads the przedmiar figures at the client price over every etap, in a crew view too', () => {
    const value = columnValueResolver({ stages, view: 'w_tools' })
    expect(value('plannedNet')?.(row)).toBe(1000)
    expect(value('donePercent')?.(row)).toBe(0.5) // Σ of BOTH crews' etapy over the przedmiar
    expect(value('remaining')?.(row)).toBe(500)
    expect(value('remainingGross')?.(row)).toBeCloseTo(615)
  })

  it("reads the executed figures at the view's own stawka and etapy", () => {
    const value = columnValueResolver({ stages, view: 'w_tools' })
    expect(value('plannedNetForPlane')?.(row)).toBeCloseTo(650)
    expect(value('stageQtySum')?.(row)).toBe(1)
    expect(value('net')?.(row)).toBeCloseTo(65)
    expect(value(stageValueNetKey(100))?.(row)).toBeCloseTo(65)
  })

  it('has no value for an etap the view does not price, or one that is gone', () => {
    const value = columnValueResolver({ stages, view: 'w_tools' })
    expect(value(stageValueNetKey(200))?.(row)).toBeNull()
    expect(value(stageValueGrossKey(200))?.(row)).toBeNull()
    expect(value(stageValueNetKey(999))?.(row)).toBeNull()
  })

  it('resolves „Pozostało" for the worker only from the all-etapy quantity it is handed', () => {
    expect(columnValueResolver({ stages, view: 'own_tools' })('remainingForPlane')).toBeUndefined()
    const value = columnValueResolver({ stages, view: 'own_tools', executedQtyByItem: { 1: 5 } })
    expect(value('remainingForPlane')?.(row)).toBe(1000) // (10 − 5) × 200
  })

  it('leaves editable columns and row fields to the caller', () => {
    const value = columnValueResolver({ stages, view: 'client' })
    for (const field of ['price', 'plannedQty', 'note', stageKey(100), 'divergence']) {
      expect(value(field), field).toBeUndefined()
    }
  })
})
