import { describe, expect, it } from 'vitest'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { kosztorysClientTotals } from '@/lib/kosztorys/settlement-client-totals'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import { deriveFinancials } from '@/lib/db/investment-financials'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'
import type { TypeSettledTotalT } from '@/types/investment-financials'

// Why this test exists (context/foundation/lessons.md): kosztorys v1 and the app once disagreed on a
// money figure while every test stayed green, because each side computed the figure its own way. Here
// the editor computes the kosztorys client totals client-side and the investment page derives them
// server-side — so the guard is to run BOTH real code paths (kosztorysClientTotals + deriveFinancials)
// against ONE dataset and assert the shared reconciler sees them agree. A second copy of either formula
// would drift and this test would go red.

// Two rows across two etapy: row 1 executes 2+3 (of planned 5) at client price 20 = 100, no rabat;
// row 2 executes 4+0 at client price 10 = 40, with a flat 'amount' rabat of 8 on the whole row.
// So executed post-rabat = 132, per-item rabat taken = 8, pre-rabat „Suma prac wykonanych" = 140.
function makeReconTree(overrides: Partial<KosztorysTreeT> = {}): KosztorysTreeT {
  return makeTree({
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
    stages: [
      { id: 100, ordinal: 1, label: null, plane: null, split: null },
      { id: 101, ordinal: 2, label: null, plane: null, split: null },
    ],
    progress: [
      { itemId: 1, stageId: 100, qtyDone: 2 },
      { itemId: 1, stageId: 101, qtyDone: 3 },
      { itemId: 2, stageId: 100, qtyDone: 4 },
    ],
    vatRate: 0.08,
    ...overrides,
  })
}

// The editor-side client totals for a tree, via the exact shared helper both surfaces call.
function clientTotals(tree: KosztorysTreeT) {
  return kosztorysClientTotals(treeToRows(tree), tree.stages, tree.globalDiscount)
}

// The transactions side is given as literals worked out by hand from the fixture, never read back from
// kosztorysClientTotals — a derived figure would move with any error on the kosztorys side and keep the
// verdict silent. The ledger plane (LABOR_COST/RABAT) is netto, so VAT never enters these figures.
function bookedTransactions(laborCostsNet: number, discountNet: number): TypeSettledTotalT[] {
  return [
    { type: 'LABOR_COST', settled: false, total: laborCostsNet },
    { type: 'RABAT', settled: false, total: discountNet },
  ]
}

// The full cross-boundary chain end to end: editor side (kosztorysClientTotals) vs investment side
// (deriveFinancials), compared by the shared reconciler — the one call that catches drift.
function reconcile(tree: KosztorysTreeT, txns: TypeSettledTotalT[]) {
  const { laborCostsNetFromKosztorys, discountNetFromKosztorys } = clientTotals(tree)
  const financials = deriveFinancials(txns)
  return buildKosztorysReconciliation({
    laborCostsNetFromKosztorys,
    discountNetFromKosztorys,
    laborCostsNetFromTransactions: financials.totalLaborCosts,
    discountNetFromTransactions: financials.totalDiscount,
  })
}

describe('cross-boundary parity: kosztorys client totals vs transaction sums', () => {
  it('per-item rabat: matching transfers reconcile silently on both figures', () => {
    const verdict = reconcile(makeReconTree(), bookedTransactions(140, 8))
    expect(verdict.laborCosts.mismatch).toBe(false)
    expect(verdict.discount.mismatch).toBe(false)
  })

  it('global amount discount (per-item rabat suppressed): matching transfers reconcile silently', () => {
    const tree = makeReconTree({ globalDiscount: { type: 'amount', value: 14 } })
    // Sanity: a live global discount zeroes per-item rabat, so the rabat figure is the flat amount.
    const { laborCostsNetFromKosztorys, discountNetFromKosztorys } = clientTotals(tree)
    expect(laborCostsNetFromKosztorys).toBeCloseTo(140) // rows go gross → no per-item rabat added back
    expect(discountNetFromKosztorys).toBeCloseTo(14) // the flat amount

    const verdict = reconcile(tree, bookedTransactions(140, 14))
    expect(verdict.laborCosts.mismatch).toBe(false)
    expect(verdict.discount.mismatch).toBe(false)
  })

  // The percent-discount bulk-apply (Phase 1) stamps the same percent into every per-item rabat instead
  // of storing a global percent. This proves the reconciled RABAT figure is identical to what the old
  // stored global-percent produced: Σ per-item percent rabaty = the same discountNetFromKosztorys (14), so the
  // investment-page recon is unchanged by the migration away from a stored percent discount.
  it('per-item percent (bulk-apply): Σ rabaty feed discountNetFromKosztorys like the old global percent', () => {
    const base = makeReconTree()
    const tree: KosztorysTreeT = {
      ...base,
      sections: base.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          discountType: 'percent' as const,
          discountValue: 10,
        })),
      })),
    }
    const { laborCostsNetFromKosztorys, discountNetFromKosztorys } = clientTotals(tree)
    expect(laborCostsNetFromKosztorys).toBeCloseTo(140) // pre-rabat basis (doneNet + itemDiscountNet) — unchanged
    expect(discountNetFromKosztorys).toBeCloseTo(14) // Σ per-item rabat: row1 10 + row2 4 — = old global 10%

    const verdict = reconcile(tree, bookedTransactions(140, 14))
    expect(verdict.laborCosts.mismatch).toBe(false)
    expect(verdict.discount.mismatch).toBe(false)
  })

  it('vatRate 0: gross equals net, matching transfers still reconcile', () => {
    const verdict = reconcile(makeReconTree({ vatRate: 0 }), bookedTransactions(140, 8))
    expect(verdict.laborCosts.mismatch).toBe(false)
    expect(verdict.discount.mismatch).toBe(false)
  })

  it('empty progress + no transfers: zero vs zero is silent', () => {
    const tree = makeReconTree({ progress: [] })
    const { laborCostsNetFromKosztorys, discountNetFromKosztorys } = clientTotals(tree)
    expect(laborCostsNetFromKosztorys).toBe(0)
    expect(discountNetFromKosztorys).toBe(0)
    const verdict = reconcile(tree, [])
    expect(verdict.laborCosts.mismatch).toBe(false)
    expect(verdict.discount.mismatch).toBe(false)
  })

  it('a de-synced LABOR_COST fires robocizna and leaves rabat silent', () => {
    // Only the LABOR_COST transfer is a full grosz off.
    const verdict = reconcile(makeReconTree(), bookedTransactions(140.01, 8))
    expect(verdict.laborCosts.mismatch).toBe(true)
    expect(verdict.discount.mismatch).toBe(false)
  })
})

describe('nothing booked on the transactions plane silences BOTH verdicts (EX-555)', () => {
  it('a populated kosztorys with no LABOR_COST and no RABAT stays silent', () => {
    const tree = makeReconTree()
    const { laborCostsNetFromKosztorys, discountNetFromKosztorys } = clientTotals(tree)
    expect(laborCostsNetFromKosztorys).toBeCloseTo(140)
    expect(discountNetFromKosztorys).toBeCloseTo(8)

    const verdict = reconcile(tree, [])
    expect(verdict.laborCosts.mismatch).toBe(false)
    expect(verdict.discount.mismatch).toBe(false)
    // Silenced, not erased — the figures stay readable so the surface can still show both sides.
    expect(verdict.laborCosts.expected).toBeCloseTo(140)
    expect(verdict.laborCosts.actual).toBe(0)
  })

  it('one figure booked and the other not still SCREAMS on the unbooked one', () => {
    // The gap the per-investment rule protects: „robocizna zaksięgowana, rabat nie" is exactly the
    // half-migrated legacy investment the alert exists for. A per-figure silence would hide it.
    const verdict = reconcile(makeReconTree(), [{ type: 'LABOR_COST', settled: false, total: 140 }])
    expect(verdict.laborCosts.mismatch).toBe(false)
    expect(verdict.discount.mismatch).toBe(true)
  })
})

describe('robocizna compares the PRE-rabat suma prac (EX-535 regression)', () => {
  // The bug this guards: kosztorysClientTotals summed the post-rabat section net for robocizna. Against
  // a correctly-populated investment (LABOR_COST = gross of the PRE-rabat suma prac, rabat a separate
  // transfer per `marża = robocizna − rabat − …`), that made robocizna false-fire on EVERY kosztorys
  // carrying a per-item rabat. The scream also sits on the „Suma prac wykonanych" row, whose displayed
  // value is pre-rabat — so the verdict must be about that same number.
  it('pre-rabat basis is silent; the old post-rabat basis would scream', () => {
    const tree = makeReconTree()
    const { laborCostsNetFromKosztorys, discountNetFromKosztorys } = clientTotals(tree)
    expect(laborCostsNetFromKosztorys).toBeCloseTo(140) // pre-rabat: 132 executed + 8 rabat taken
    expect(discountNetFromKosztorys).toBeCloseTo(8)

    const silent = buildKosztorysReconciliation({
      laborCostsNetFromKosztorys,
      discountNetFromKosztorys,
      laborCostsNetFromTransactions: laborCostsNetFromKosztorys,
      discountNetFromTransactions: discountNetFromKosztorys,
    })
    expect(silent.laborCosts.mismatch).toBe(false)

    // The old code's basis (post-rabat executed net = 132) is a different number from the pre-rabat
    // 140, so a correctly-populated LABOR_COST (the pre-rabat 140) must NOT equal it — proving the two
    // are genuinely different and the pre/post choice is load-bearing.
    const postDiscountNet = laborCostsNetFromKosztorys - discountNetFromKosztorys
    expect(postDiscountNet).toBeCloseTo(132)
    expect(postDiscountNet).not.toBeCloseTo(laborCostsNetFromKosztorys)
  })
})

describe('reconciliation compares netto ↔ netto — the ledger plane carries no VAT (EX-535)', () => {
  // VAT is a client-pricing concept (prace only); LABOR_COST/RABAT transactions are netto. So a
  // kosztorys rabat of 100 reconciles against a netto RABAT of 100 — NOT a grossed 102. This is the
  // regression guard for the „rabat 100 vs 102" false-fire: we no longer gross the kosztorys side.
  // (context/reference/kosztorys-editor-domain-notes.md, „VAT dotyczy wyłącznie prac".)
  it('rabat 100 reconciles against a netto RABAT of 100, and robocizna net-to-net is silent', () => {
    const verdict = buildKosztorysReconciliation({
      laborCostsNetFromKosztorys: 5000,
      discountNetFromKosztorys: 100,
      laborCostsNetFromTransactions: 5000,
      discountNetFromTransactions: 100,
    })
    expect(verdict.discount.expected).toBeCloseTo(100)
    expect(verdict.discount.mismatch).toBe(false)
    expect(verdict.laborCosts.mismatch).toBe(false)
  })

  it('a grossed RABAT (102) now FALSE-fires — proving the kosztorys side is no longer grossed', () => {
    const verdict = buildKosztorysReconciliation({
      laborCostsNetFromKosztorys: 5000,
      discountNetFromKosztorys: 100,
      laborCostsNetFromTransactions: 5000,
      discountNetFromTransactions: 102,
    })
    expect(verdict.discount.mismatch).toBe(true)
  })
})

describe('grosz-exact tolerance (no fuzzy epsilon)', () => {
  const base = { discountNetFromKosztorys: 0, discountNetFromTransactions: 0 }

  it('equal to the grosz → no mismatch', () => {
    const verdict = buildKosztorysReconciliation({
      ...base,
      laborCostsNetFromKosztorys: 100,
      laborCostsNetFromTransactions: 100,
    })
    expect(verdict.laborCosts.mismatch).toBe(false)
  })

  it('a full grosz apart → mismatch', () => {
    const verdict = buildKosztorysReconciliation({
      ...base,
      laborCostsNetFromKosztorys: 100,
      laborCostsNetFromTransactions: 100.01,
    })
    expect(verdict.laborCosts.mismatch).toBe(true)
  })

  it('sub-grosz apart (rounds to the same grosz) → no mismatch', () => {
    const verdict = buildKosztorysReconciliation({
      ...base,
      laborCostsNetFromKosztorys: 100.002,
      laborCostsNetFromTransactions: 100.001,
    })
    expect(verdict.laborCosts.mismatch).toBe(false)
  })
})
