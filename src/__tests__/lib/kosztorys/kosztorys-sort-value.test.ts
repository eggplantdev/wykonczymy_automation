import { describe, expect, it } from 'vitest'
import { columnSortValue, reconcileSort } from '@/lib/kosztorys/sort-value'
import { sortRows } from '@/lib/kosztorys/row-view'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

// Two rows whose COMPUTED figures order differently from their raw fields, so a test that passes
// can only pass because the computed value was actually resolved — not because input order survived.
//
// Item 1 (id 1): big przedmiar, tiny stage sum, a 10% rabat → high plannedNet/remaining, low net.
// Item 2 (id 2): tiny przedmiar, stage sum OVER przedmiar, no rabat → high net, negative remaining.
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
        {
          id: 1,
          sectionId: 10,
          displayOrder: 0,
          description: 'A',
          unit: 'm2',
          plannedQty: 10,
          discountType: 'percent',
          discountValue: 10,
          clientPrice: 100,
          wToolsOverrideType: null,
          wToolsOverrideValue: 0,
          ownToolsOverrideType: null,
          ownToolsOverrideValue: 0,
          costVariant: null,
          hiddenInExport: false,
          note: null,
        },
        {
          id: 2,
          sectionId: 10,
          displayOrder: 1,
          description: 'B',
          unit: 'm2',
          plannedQty: 2,
          discountType: null,
          discountValue: 0,
          clientPrice: 50,
          wToolsOverrideType: null,
          wToolsOverrideValue: 0,
          ownToolsOverrideType: null,
          ownToolsOverrideValue: 0,
          costVariant: null,
          hiddenInExport: false,
          note: null,
        },
      ],
    },
  ],
  stages: [{ id: 100, ordinal: 1, label: null }],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 1 },
    { itemId: 2, stageId: 100, qtyDone: 8 },
  ],
  globalCoeffs: { wTools: 0.65, ownTools: 0.55 },
  vatRate: 0.23,
  globalDiscount: { type: null, value: 0 },
  revision: '2026-01-01T00:00:00.000Z',
}

const rows = treeToRows(tree)
const idsSortedBy = (field: string) =>
  sortRows(rows, (r) => columnSortValue(r, field, 'client', tree.stages), 'desc').map((r) => r.id)

describe('columnSortValue — computed money/percent columns actually sort (EX-487)', () => {
  // Every one of these is a computed column, not a KosztorysV2RowT field: before the fix each
  // resolved to '' for all rows and the sort was a silent no-op, leaving input order [1, 2].
  it.each([
    ['net', [2, 1]], // executed value: B 400 > A 90
    ['gross', [2, 1]], // net × VAT — same order as net
    ['plannedNet', [1, 2]], // offer value: A 900 > B 100 — OPPOSITE of net, so raw fields can't fake it
    ['plannedGross', [1, 2]],
    ['priceGross', [1, 2]], // 100 vs 50 at the client price
    ['discountAmount', [1, 2]], // A carries a 10% rabat (10), B none (0)
    ['discountAmountGross', [1, 2]],
    ['remaining', [1, 2]], // A +810 left, B −300 (overshot the offer)
    ['remainingGross', [1, 2]],
    ['stageQtySum', [2, 1]], // Σ etapów: B 8 > A 1
    ['donePercent', [2, 1]], // B 400% > A 10%
  ])('sorts by %s → %j', (field, expected) => {
    expect(idsSortedBy(field)).toEqual(expected)
  })

  it('still sorts by a real row field (plannedQty)', () => {
    expect(idsSortedBy('plannedQty')).toEqual([1, 2]) // 10 > 2
  })
})

describe('reconcileSort — a sort whose column has left the grid is dropped (EX-486)', () => {
  const rendered = new Set(['net', 'remaining', 'plannedQty'])

  it('keeps a sort whose field still renders', () => {
    const sort = { field: 'net', dir: 'asc' as const }
    expect(reconcileSort(sort, rendered)).toBe(sort)
  })

  it('drops a sort whose field no longer renders (e.g. remainingGross after the Netto axis toggle)', () => {
    expect(reconcileSort({ field: 'remainingGross', dir: 'desc' as const }, rendered)).toBeNull()
  })

  it('passes null through', () => {
    expect(reconcileSort(null, rendered)).toBeNull()
  })
})
