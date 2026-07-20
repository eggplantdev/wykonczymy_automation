import { describe, expect, it } from 'vitest'
import { toClientView } from '@/lib/kosztorys/to-client-view'
import { rowValueForView, sectionSubtotalsForView } from '@/lib/kosztorys/settlement'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

// Subcontractor pricing is deliberately LOUD in this fixture: flat overrides far below the client
// price, plus non-default coefficients. If any of those numbers can be reconstructed from the
// projected payload, the leak test below fails on a real figure rather than on a naming convention.
const baseItem = {
  sectionId: 10,
  displayOrder: 0,
  unit: 'm2',
  discountType: null,
  discountValue: 0,
  wToolsOverrideType: 'amount' as const,
  wToolsOverrideValue: 6.13,
  ownToolsOverrideType: 'amount' as const,
  ownToolsOverrideValue: 2.77,
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
      wToolsCoeff: 0.42,
      ownToolsCoeff: null,
      items: [
        { ...baseItem, id: 1, description: 'A', plannedQty: 5, clientPrice: 20 },
        { ...baseItem, id: 2, description: 'B', plannedQty: 4, clientPrice: 10 },
      ],
    },
    {
      id: 11,
      name: 'Sekcja B',
      displayOrder: 1,
      defaultCostVariant: 'own_tools',
      wToolsCoeff: null,
      ownToolsCoeff: null,
      items: [
        { ...baseItem, id: 3, sectionId: 11, description: 'C', plannedQty: 2, clientPrice: 50 },
      ],
    },
  ],
  stages: [
    { id: 100, ordinal: 1, label: 'Etap 1' },
    { id: 101, ordinal: 2, label: null },
  ],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 2 },
    { itemId: 1, stageId: 101, qtyDone: 3 },
    { itemId: 2, stageId: 100, qtyDone: 4 },
    { itemId: 3, stageId: 101, qtyDone: 1 },
  ],
  globalCoeffs: { wTools: 0.65, ownTools: 0.55 },
  vatRate: 0.08,
  globalDiscount: { type: null, value: 0 },
  revision: '2026-01-01T00:00:00.000Z',
}

const financials = {
  investmentName: 'Testowa',
  materialsNet: 1000,
  materialsBreakdown: [],
  depositsNet: 250,
}

// Every key name that would indicate a subcontractor figure rode along. Matched case-insensitively
// against the whole serialized payload, keys AND values, so a nested or renamed carrier still trips.
const FORBIDDEN = ['costvariant', 'wtools', 'owntools', 'override', 'coeff']

describe('toClientView — the leak boundary', () => {
  it('the serialized payload carries no subcontractor field of any kind', () => {
    const serialized = JSON.stringify(toClientView(tree, financials)).toLowerCase()
    for (const needle of FORBIDDEN) expect(serialized).not.toContain(needle)
  })

  it('no subcontractor AMOUNT survives, even stripped of its field name', () => {
    // Names being gone is not enough — a figure could be re-labelled. These are the numbers
    // themselves: the per-unit subcontractor prices and the coefficients they derive from. Compared
    // as numeric leaves, not as substrings, so an unrelated 0.7368… can't mask a real 0.42.
    const leaves: number[] = []
    const walk = (node: unknown): void => {
      if (typeof node === 'number') leaves.push(node)
      else if (node && typeof node === 'object') Object.values(node).forEach(walk)
    }
    walk(toClientView(tree, financials))
    for (const amount of [6.13, 2.77, 0.42, 0.65, 0.55]) expect(leaves).not.toContain(amount)
  })

  it('projects money at the client price, not the active price view', () => {
    const rows = treeToRows(tree)
    const clientExecuted = rows.reduce(
      (sum, r) => sum + rowValueForView(r, tree.stages, 'client'),
      0,
    )
    const view = toClientView(tree, financials)
    expect(view.totals.robociznaNet).toBeCloseTo(clientExecuted)
    // Σ per-etap equals the executed total — the suma-transzy invariant, carried into the payload.
    const stageSum = view.totals.stageTotals.reduce((sum, s) => sum + s.net, 0)
    expect(stageSum).toBeCloseTo(clientExecuted)
  })
})

describe('toClientView — what the client does get', () => {
  it('keeps every row with its przedmiar, cena and per-etap quantities', () => {
    const view = toClientView(tree, financials)
    expect(view.rows).toHaveLength(3)
    expect(view.rows[0]).toMatchObject({
      id: 1,
      sectionName: 'Sekcja A',
      plannedQty: 5,
      clientPrice: 20,
      stageQty: { 100: 2, 101: 3 },
    })
    // A stage the row never touched is present as 0, not absent — the grid renders a column per etap.
    expect(view.rows[2].stageQty[100]).toBe(0)
  })

  it('carries section shares matching the editor’s own client-view subtotals', () => {
    const expected = sectionSubtotalsForView(treeToRows(tree), tree.stages, 'client')
    const view = toClientView(tree, financials)
    expect(view.sections.map((s) => s.sectionId)).toEqual(expected.map((s) => s.sectionId))
    view.sections.forEach((section, index) => {
      expect(section.net).toBeCloseTo(expected[index].net)
      expect(section.share).toBeCloseTo(expected[index].share)
    })
  })

  it('passes the financial-plane figures through untouched', () => {
    const view = toClientView(tree, financials)
    expect(view.totals.materialsNet).toBe(1000)
    expect(view.totals.depositsNet).toBe(250)
    expect(view.investmentName).toBe('Testowa')
    expect(view.vatRate).toBe(0.08)
  })
})

describe('toClientView — hiddenInExport', () => {
  // A hidden row must vanish from the projection AND from every total derived from it — dropping it
  // from the row list alone would leave the client's visible rows summing to one figure while the
  // footer showed another. The fixture hides one row in Sekcja A and asserts the whole section it
  // shared collapses to just its surviving sibling.
  const withHidden: KosztorysTreeT = {
    ...tree,
    sections: tree.sections.map((section) =>
      section.id === 10
        ? {
            ...section,
            items: section.items.map((item) =>
              item.id === 1 ? { ...item, hiddenInExport: true } : item,
            ),
          }
        : section,
    ),
  }

  it('drops the hidden row from the projected rows', () => {
    const view = toClientView(withHidden, financials)
    expect(view.rows.map((r) => r.id)).toEqual([2, 3])
  })

  it('excludes the hidden row from section subtotals, shares and stage totals', () => {
    const full = toClientView(tree, financials)
    const view = toClientView(withHidden, financials)

    // The visible payload must match what the editor's own client-view subtotals compute over the
    // SAME visible rows — the totals are recomputed, not merely re-filtered after the fact.
    const visibleRows = treeToRows(withHidden).filter((r) => !r.hiddenInExport)
    const expected = sectionSubtotalsForView(visibleRows, withHidden.stages, 'client')
    expect(view.sections.map((s) => s.sectionId)).toEqual(expected.map((s) => s.sectionId))
    view.sections.forEach((section, index) => {
      expect(section.net).toBeCloseTo(expected[index].net)
      expect(section.share).toBeCloseTo(expected[index].share)
    })

    // And the executed total actually fell — row 1 carried real quantities, so hiding it is not a
    // no-op the subtotal comparison could pass vacuously.
    expect(view.totals.robociznaNet).toBeLessThan(full.totals.robociznaNet)
    const stageSum = view.totals.stageTotals.reduce((sum, s) => sum + s.net, 0)
    expect(stageSum).toBeCloseTo(view.totals.robociznaNet)
  })
})
