import { describe, expect, it } from 'vitest'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import {
  rowValueForView,
  sectionSubtotalsForView,
  stageTotalsForView,
} from '@/lib/kosztorys/settlement'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

const baseItem = {
  sectionId: 10,
  displayOrder: 0,
  unit: 'm2',
  discountType: null,
  discountValue: 0,
  wToolsOverrideType: 'amount' as const,
  wToolsOverrideValue: 12,
  ownToolsOverrideType: 'amount' as const,
  ownToolsOverrideValue: 10,
  costVariant: null,
  hiddenInExport: false,
  note: null,
}

// Two rows across two etapy: row 1 executes 2+3 (of planned 5) at client price 20; row 2 executes
// 4+0 at client price 10, with a flat 'amount' rabat of 8 on the whole row.
const tree: KosztorysTreeT = {
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      defaultCostVariant: 'w_tools',
      wToolsCoeff: null,
      ownToolsCoeff: null,
      items: [
        { ...baseItem, id: 1, description: 'A', plannedQty: 5, clientPrice: 20 },
        {
          ...baseItem,
          id: 2,
          description: 'B',
          plannedQty: 4,
          clientPrice: 10,
          discountType: 'amount' as const,
          discountValue: 8,
        },
      ],
    },
  ],
  stages: [
    { id: 100, ordinal: 1, label: null },
    { id: 101, ordinal: 2, label: null },
  ],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 2 },
    { itemId: 1, stageId: 101, qtyDone: 3 },
    { itemId: 2, stageId: 100, qtyDone: 4 },
  ],
  globalCoeffs: { wTools: 0.65, ownTools: 0.55 },
  vatRate: 0.08,
  globalDiscount: { type: null, value: 0 },
  revision: '2026-01-01T00:00:00.000Z',
}

describe('stageTotalsForView', () => {
  it('every stage gets an entry, empty stages read 0', () => {
    const empty = treeToRows({ ...tree, progress: [] })
    const totals = stageTotalsForView(empty, tree.stages, 'client')
    expect(totals.size).toBe(2)
    expect(totals.get(100)).toBe(0)
    expect(totals.get(101)).toBe(0)
  })

  it('Σ etap totals across stages equals Σ row executed values (rabat reconciliation)', () => {
    const rows = treeToRows(tree)
    const totals = stageTotalsForView(rows, tree.stages, 'client')
    const stageSum = [...totals.values()].reduce((s, v) => s + v, 0)
    const rowSum = rows.reduce((s, r) => s + rowValueForView(r, tree.stages, 'client'), 0)
    expect(stageSum).toBeCloseTo(rowSum)
  })

  it('per-stage figures follow the qty share of each row', () => {
    const rows = treeToRows(tree)
    const totals = stageTotalsForView(rows, tree.stages, 'client')
    // Row 1: executed 5 qty @ 20 = 100, no rabat → stage 100 = 2/5·100 = 40, stage 101 = 3/5·100 = 60.
    // Row 2: executed 4 qty @ 10 = 40 − 8 rabat = 32, all in stage 100.
    expect(totals.get(100)).toBeCloseTo(40 + 32)
    expect(totals.get(101)).toBeCloseTo(60)
  })

  it('switching to the subcontractor view changes the totals', () => {
    const rows = treeToRows(tree)
    const client = stageTotalsForView(rows, tree.stages, 'client')
    const wTools = stageTotalsForView(rows, tree.stages, 'w_tools')
    expect(wTools.get(100)).not.toBeCloseTo(client.get(100)!)
  })
})

describe('sectionSubtotalsForView › discount (per-item rabat aggregate)', () => {
  it('sums the per-item rabat actually taken on the executed qty', () => {
    const rows = treeToRows(tree)
    const [section] = sectionSubtotalsForView(rows, tree.stages, 'client')
    // Only item 2 carries a rabat (flat 8 on the whole row), and it executes 4 of its 4 planned qty,
    // so the full 8 is taken; item 1 has none → section discount = 8.
    expect(section.discount).toBeCloseTo(8)
  })

  it('reads 0 when the global discount is active (it overrides per-item rabat)', () => {
    const globalTree = { ...tree, globalDiscount: { type: 'percent' as const, value: 10 } }
    const rows = treeToRows(globalTree)
    const [section] = sectionSubtotalsForView(rows, globalTree.stages, 'client')
    expect(section.discount).toBeCloseTo(0)
  })
})
