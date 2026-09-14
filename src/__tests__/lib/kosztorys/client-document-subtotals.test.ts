import { describe, expect, it } from 'vitest'
import { applyRowConditions } from '@/lib/kosztorys/row-conditions/queries'
import { clientConditionIds } from '@/lib/kosztorys/row-conditions/registry'
import { sectionSubtotalsForView } from '@/lib/kosztorys/settlement-aggregates'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type { KosztorysItemT, KosztorysTreeT } from '@/lib/kosztorys/types'
import { makeTree } from '@/__tests__/helpers/kosztorys-tree'

function item(id: number, sectionId: number, overrides: Partial<KosztorysItemT> = {}) {
  return {
    id,
    sectionId,
    displayOrder: id,
    description: `Pozycja ${id}`,
    unit: 'm2',
    plannedQty: 10,
    sheetMeasuredQty: null,
    discountType: null,
    discountValue: 0,
    clientPrice: 100,
    wToolsOverrideValue: null,
    ownToolsOverrideValue: null,
    note: null,
    ...overrides,
  } satisfies KosztorysItemT
}

const STAGES = [{ id: 100, ordinal: 1, label: null, plane: 'w_tools' as const, workerId: null }]

// Sekcja A: two priced pozycje plus one empty on both axes — no przedmiar, no etap. Sekcja B holds
// nothing but such pozycje, so the client's document has no Sekcja B at all.
const tree: KosztorysTreeT = makeTree({
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      color: null,
      items: [item(1, 10), item(2, 10), item(3, 10, { plannedQty: 0 })],
    },
    {
      id: 20,
      name: 'Sekcja B',
      displayOrder: 1,
      color: null,
      items: [item(4, 20, { plannedQty: 0 }), item(5, 20, { plannedQty: 0 })],
    },
  ],
  stages: STAGES,
  progress: [{ itemId: 1, stageId: 100, qtyDone: 4 }],
})

const rows = treeToRows(tree)
const documentRows = applyRowConditions(rows, clientConditionIds(true), {
  stages: tree.stages,
  hasSettledMaterial: false,
  divergentPriceRowIds: new Set<number>(),
})

const ownerSubtotals = sectionSubtotalsForView(rows, tree.stages, 'client')
const clientSubtotals = sectionSubtotalsForView(documentRows, tree.stages, 'client')

// The header renders „Sekcja A (n poz.)" straight off itemCount, so a subtotal built over rows the
// client's document does not contain announces pozycje nobody can point at.
describe('section subtotals over the document the client actually receives', () => {
  it('counts only the pozycje that document holds', () => {
    expect(ownerSubtotals.find((s) => s.sectionId === 10)!.itemCount).toBe(3)
    expect(clientSubtotals.find((s) => s.sectionId === 10)!.itemCount).toBe(2)
  })

  it('drops a section made only of such pozycje rather than heading it „(0 poz.)"', () => {
    expect(ownerSubtotals.map((s) => s.sectionId)).toEqual([10, 20])
    expect(clientSubtotals.map((s) => s.sectionId)).toEqual([10])
  })

  it('moves no money — a hidden pozycja is empty on both axes and adds zero to every figure', () => {
    const owner = ownerSubtotals.find((s) => s.sectionId === 10)!
    const client = clientSubtotals.find((s) => s.sectionId === 10)!

    expect(client.net).toBe(owner.net)
    expect(client.plannedNet).toBe(owner.plannedNet)
    expect(client.discount).toBe(owner.discount)
    expect(client.share).toBe(owner.share)
    expect(client.completionRatio).toBe(owner.completionRatio)
  })
})
