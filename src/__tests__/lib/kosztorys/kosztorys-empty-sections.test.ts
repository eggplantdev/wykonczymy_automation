import { describe, expect, it } from 'vitest'
import { countMatching, sectionIdsWhereAllMatch } from '@/lib/kosztorys/row-conditions/queries'
import { sectionSubtotalsForView } from '@/lib/kosztorys/settlement-aggregates'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type { KosztorysItemT, KosztorysTreeT } from '@/lib/kosztorys/types'
import { makeTree } from '@/__tests__/helpers/kosztorys-tree'

function item(id: number, sectionId: number, overrides: Partial<KosztorysItemT> = {}) {
  return {
    id,
    sectionId,
    displayOrder: 0,
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

// A: worked and priced. B: nothing executed. C: fully executed but never priced — its subtotal is
// zero for a reason that is a defect, not a state, which is what the cases below separate.
const tree: KosztorysTreeT = makeTree({
  sections: [
    { id: 10, name: 'Sekcja A', displayOrder: 0, color: null, items: [item(1, 10)] },
    { id: 20, name: 'Sekcja B', displayOrder: 1, color: null, items: [item(2, 20)] },
    {
      id: 30,
      name: 'Sekcja C',
      displayOrder: 2,
      color: null,
      items: [item(3, 30, { clientPrice: 0 })],
    },
  ],
  stages: STAGES,
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 4 },
    { itemId: 3, stageId: 100, qtyDone: 10 },
  ],
})

const rows = treeToRows(tree)
const ctx = {
  stages: tree.stages,
  hasSettledMaterial: false,
  divergentPriceRowIds: new Set<number>(),
}

describe('a section fully executed but unpriced', () => {
  it('sums to zero — which is why the old net-is-zero rule folded it away', () => {
    const subtotals = sectionSubtotalsForView(rows, tree.stages, 'client')

    expect(subtotals.find((s) => s.sectionId === 30)!.net).toBe(0)
  })

  it('is not folded by „bez pomiaru z natury" — the work IS recorded', () => {
    expect([...sectionIdsWhereAllMatch(rows, 'no-measured-qty', ctx)]).toEqual([20])
  })

  // The executed half of the split: work recorded at no price is the unbillable case, and it must not
  // land in „bez ceny j.m. i bez wykonanej pracy", which is the merely-unfinished offer.
  it('is counted by the „z wykonaną pracą bez ceny j.m." diagnostic instead of being hidden', () => {
    expect(countMatching(rows, 'no-client-price-with-work', ctx)).toBe(1)
    expect(countMatching(rows, 'no-client-price', ctx)).toBe(0)
  })
})

describe('„zwiń sekcje wg warunku" — the section list it unticks', () => {
  // The fold is a one-shot deselect on FilterMultiSelect's string encoding, so the grid can only
  // ever show what the checkmarks say.
  const deselect = (current: string[], conditionId: string) => {
    const folded = sectionIdsWhereAllMatch(rows, conditionId, ctx)
    return current.filter((value) => !folded.has(Number(value)))
  }

  it('drops the sections the condition names and leaves the rest ticked', () => {
    expect(deselect(['10', '20', '30'], 'no-measured-qty')).toEqual(['10', '30'])
  })

  it('is a no-op on a selection holding none of them', () => {
    expect(deselect(['10', '30'], 'no-measured-qty')).toEqual(['10', '30'])
  })

  it('can empty the selection outright — „pokaż nic", not „pokaż wszystko"', () => {
    expect(deselect(['20'], 'no-measured-qty')).toEqual([])
  })
})
