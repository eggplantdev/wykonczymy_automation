import { describe, expect, it } from 'vitest'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { sectionSubtotalsForView, stageAxisForView } from '@/lib/kosztorys/settlement-aggregates'
import {
  sumSectionSubtotalsNet,
  kosztorysClientTotals,
} from '@/lib/kosztorys/settlement-client-totals'
import { rowValueForView } from '@/lib/kosztorys/settlement-rows'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { baseItem, makeStage, makeTree } from '@/__tests__/helpers/kosztorys-tree'

const tree: KosztorysTreeT = makeTree({
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      color: null,
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
  // Mixed planes on purpose: with both stages left unassigned every subcontractor-view assertion
  // below reduces to 0-vs-something and passes without exercising the plane filter at all.
  stages: [makeStage({ id: 100 }), makeStage({ id: 101, ordinal: 2, plane: 'own_tools' })],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 2 },
    { itemId: 1, stageId: 101, qtyDone: 3 },
    { itemId: 2, stageId: 100, qtyDone: 4 },
  ],
  vatRate: 0.08,
})

describe('stageAxisForView', () => {
  it('every stage gets an entry, empty stages read 0', () => {
    const empty = treeToRows({ ...tree, progress: [] })
    const { net: totals } = stageAxisForView(empty, tree.stages, 'client')
    expect(totals.size).toBe(2)
    expect(totals.get(100)).toBe(0)
    expect(totals.get(101)).toBe(0)
  })

  it('Σ etap totals across stages equals Σ row executed values (rabat reconciliation)', () => {
    const rows = treeToRows(tree)
    const { net: totals } = stageAxisForView(rows, tree.stages, 'client')
    const stageSum = [...totals.values()].reduce((s, v) => s + v, 0)
    const rowSum = rows.reduce((s, r) => s + rowValueForView(r, tree.stages, 'client'), 0)
    expect(stageSum).toBeCloseTo(rowSum)
  })

  it('per-stage figures follow the qty share of each row', () => {
    const rows = treeToRows(tree)
    const { net: totals } = stageAxisForView(rows, tree.stages, 'client')
    // Row 1: executed 5 qty @ 20 = 100, no rabat → stage 100 = 2/5·100 = 40, stage 101 = 3/5·100 = 60.
    // Row 2: executed 4 qty @ 10 = 40 − 8 rabat = 32, all in stage 100.
    expect(totals.get(100)).toBeCloseTo(40 + 32)
    expect(totals.get(101)).toBeCloseTo(60)
  })

  // It is the one that breaks when
  // the per-stage split divides a view-scoped total across every stage: the out-of-view etap then
  // takes a share > 1 of the row and Σ overshoots „Razem" by a multiple.
  it.each(['w_tools', 'own_tools'] as const)(
    'Σ etap totals equals Σ row executed values in the %s view too',
    (view) => {
      const rows = treeToRows(tree)
      const { net: totals } = stageAxisForView(rows, tree.stages, view)
      const stageSum = [...totals.values()].reduce((s, v) => s + v, 0)
      const rowSum = rows.reduce((s, r) => s + rowValueForView(r, tree.stages, view), 0)
      expect(stageSum).toBeCloseTo(rowSum)
    },
  )

  it('gives an out-of-view etap nothing — its value belongs to the other crew', () => {
    const rows = treeToRows(tree)
    // Etap 100 is w_tools, 101 is own_tools. In the w_tools view only 100's qty is executed work
    // (row 1: 2, row 2: 4) at the w_tools price 12 → 72; etap 101 is not this crew's bill at all.
    const { net: wTools } = stageAxisForView(rows, tree.stages, 'w_tools')
    expect(wTools.get(100)).toBeCloseTo(72)
    expect(wTools.get(101)).toBe(0)

    // Mirror image: own_tools sees only etap 101 (row 1: 3 @ own_tools price 10 → 30).
    const { net: ownTools } = stageAxisForView(rows, tree.stages, 'own_tools')
    expect(ownTools.get(100)).toBe(0)
    expect(ownTools.get(101)).toBeCloseTo(30)
  })

  it('totals the executed quantity per etap alongside its value, under the same view scoping', () => {
    const rows = treeToRows(tree)

    const { qty } = stageAxisForView(rows, tree.stages, 'client')
    expect(qty.get(100)).toBe(6)
    expect(qty.get(101)).toBe(3)

    const wTools = stageAxisForView(rows, tree.stages, 'w_tools').qty
    expect(wTools.get(100)).toBe(6)
    expect(wTools.get(101)).toBe(0)
  })
})

describe('sectionSubtotalsForView › discount (per-item rabat aggregate)', () => {
  it('sums the per-item rabat actually taken on the executed qty', () => {
    const rows = treeToRows(tree)
    const [section] = sectionSubtotalsForView(rows, tree.stages, 'client')
    expect(section.discount).toBeCloseTo(8)
  })

  it('reads 0 when the global discount is active (it overrides per-item rabat)', () => {
    const globalTree = { ...tree, globalDiscount: { type: 'amount' as const, value: 10 } }
    const rows = treeToRows(globalTree)
    const [section] = sectionSubtotalsForView(rows, globalTree.stages, 'client')
    expect(section.discount).toBeCloseTo(0)
  })

  it('reads 0 in a subcontractor view (rabat is client-only)', () => {
    const rows = treeToRows(tree)
    for (const view of ['w_tools', 'own_tools'] as const) {
      const [section] = sectionSubtotalsForView(rows, tree.stages, view)
      expect(section.discount).toBeCloseTo(0)
    }
  })
})

describe('sectionSubtotalsForView › plannedNet (przedmiar) is client-only', () => {
  // Asserting `null`, not 0: 0 would be a claim that nothing was offered.
  it('is withheld in a subcontractor view', () => {
    const rows = treeToRows(tree)
    for (const view of ['w_tools', 'own_tools'] as const) {
      const [section] = sectionSubtotalsForView(rows, tree.stages, view)
      expect(section.plannedNet).toBeNull()
    }
  })

  it('is present in the client view', () => {
    const rows = treeToRows(tree)
    const [section] = sectionSubtotalsForView(rows, tree.stages, 'client')
    // Item 1: 5 planned @ 20 = 100. Item 2: 4 planned @ 10 = 40, less its flat-8 rabat = 32.
    expect(section.plannedNet).toBeCloseTo(132)
  })
})

describe('sumSectionSubtotalsNet (subcontractor należne)', () => {
  const PRE_DISCOUNT_CLIENT = 140

  it('adds the per-item rabat back — Σ(net + discount) is the pre-rabat executed value', () => {
    const rows = treeToRows(tree)
    const subtotals = sectionSubtotalsForView(rows, tree.stages, 'client')
    expect(sumSectionSubtotalsNet(subtotals)).toBeCloseTo(PRE_DISCOUNT_CLIENT)
  })

  it('is unaffected by an active global discount (net already gross, discount 0)', () => {
    const globalTree = { ...tree, globalDiscount: { type: 'amount' as const, value: 10 } }
    const rows = treeToRows(globalTree)
    const subtotals = sectionSubtotalsForView(rows, globalTree.stages, 'client')
    expect(sumSectionSubtotalsNet(subtotals)).toBeCloseTo(PRE_DISCOUNT_CLIENT)
  })

  it('reprices with the active view — subcontractor price differs from client', () => {
    const rows = treeToRows(tree)
    const client = sumSectionSubtotalsNet(sectionSubtotalsForView(rows, tree.stages, 'client'))
    const wTools = sumSectionSubtotalsNet(sectionSubtotalsForView(rows, tree.stages, 'w_tools'))
    expect(wTools).not.toBeCloseTo(client)
  })
})

describe('kosztorysClientTotals — rabat globalny w trybie kwotowym', () => {
  const withDiscount = (globalDiscount: KosztorysTreeT['globalDiscount']) => {
    const next = { ...tree, globalDiscount }
    return kosztorysClientTotals(treeToRows(next), next.stages, globalDiscount)
  }

  it('tryb wyłączony → rabat to suma rabatów per pozycja', () => {
    expect(withDiscount({ type: null, value: 0 }).discountNetFromKosztorys).toBeGreaterThan(0)
  })

  it('kwota 0 → zero rabatu, rabaty per pozycja pozostają wyłączone', () => {
    expect(withDiscount({ type: 'amount', value: 0 }).discountNetFromKosztorys).toBe(0)
  })

  it('kwota dodatnia → rabat to sama kwota globalna', () => {
    expect(withDiscount({ type: 'amount', value: 5 }).discountNetFromKosztorys).toBeCloseTo(5)
  })
})
