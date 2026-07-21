import { describe, expect, it } from 'vitest'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { kosztorysClientTotals } from '@/lib/kosztorys/settlement'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import { deriveFinancials } from '@/lib/db/investment-financials'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import type { TypeSettledTotalT } from '@/types/investment-financials'

// Why this test exists (context/foundation/lessons.md): kosztorys v1 and the app once disagreed on a
// money figure while every test stayed green, because each side computed the figure its own way. Here
// the editor computes the kosztorys client totals client-side and the investment page derives them
// server-side — so the guard is to run BOTH real code paths (kosztorysClientTotals + deriveFinancials)
// against ONE dataset and assert the shared reconciler sees them agree. A second copy of either formula
// would drift and this test would go red.

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

// Two rows across two etapy: row 1 executes 2+3 (of planned 5) at client price 20 = 100, no rabat;
// row 2 executes 4+0 at client price 10 = 40, with a flat 'amount' rabat of 8 on the whole row.
// So executed post-rabat = 132, per-item rabat taken = 8, pre-rabat „Suma prac wykonanych" = 140.
function makeTree(overrides: Partial<KosztorysTreeT> = {}): KosztorysTreeT {
  return {
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
    ...overrides,
  }
}

// The editor-side client totals for a tree, via the exact shared helper both surfaces call.
function clientTotals(tree: KosztorysTreeT) {
  return kosztorysClientTotals(treeToRows(tree), tree.stages, tree.globalDiscount)
}

// A correctly-populated investment: one LABOR_COST + one RABAT transfer equal to the kosztorys client
// NETS. VAT is a client-pricing concept only — the ledger plane (LABOR_COST/RABAT) is netto, so the
// synced transactions equal the client nets directly, with no grossing.
function syncedTransactions(tree: KosztorysTreeT): TypeSettledTotalT[] {
  const { sumaPracNet, rabatClientNet } = clientTotals(tree)
  return [
    { type: 'LABOR_COST', settled: false, total: sumaPracNet },
    { type: 'RABAT', settled: false, total: rabatClientNet },
  ]
}

// The full cross-boundary chain end to end: editor side (kosztorysClientTotals) vs investment side
// (deriveFinancials), compared by the shared reconciler — the one call that catches drift.
function reconcile(tree: KosztorysTreeT, txns: TypeSettledTotalT[]) {
  const { sumaPracNet, rabatClientNet } = clientTotals(tree)
  const financials = deriveFinancials(txns)
  return buildKosztorysReconciliation({
    sumaPracNet,
    rabatClientNet,
    laborCostsNetFromTransactions: financials.totalLaborCosts,
    investmentRabat: financials.totalRabat,
  })
}

describe('cross-boundary parity: kosztorys client totals vs transaction sums', () => {
  it('per-item rabat: matching transfers reconcile silently on both figures', () => {
    const tree = makeTree()
    const verdict = reconcile(tree, syncedTransactions(tree))
    expect(verdict.laborCosts.mismatch).toBe(false)
    expect(verdict.rabat.mismatch).toBe(false)
  })

  it('global discount (per-item rabat suppressed): matching transfers reconcile silently', () => {
    const tree = makeTree({ globalDiscount: { type: 'percent', value: 10 } })
    // Sanity: a live global discount zeroes per-item rabat, so the rabat figure is the global amount.
    const { sumaPracNet, rabatClientNet } = clientTotals(tree)
    expect(sumaPracNet).toBeCloseTo(140) // rows go gross → no per-item rabat added back
    expect(rabatClientNet).toBeCloseTo(14) // 10% of 140

    const verdict = reconcile(tree, syncedTransactions(tree))
    expect(verdict.laborCosts.mismatch).toBe(false)
    expect(verdict.rabat.mismatch).toBe(false)
  })

  it('vatRate 0: gross equals net, matching transfers still reconcile', () => {
    const tree = makeTree({ vatRate: 0 })
    const verdict = reconcile(tree, syncedTransactions(tree))
    expect(verdict.laborCosts.mismatch).toBe(false)
    expect(verdict.rabat.mismatch).toBe(false)
  })

  it('empty progress + no transfers: zero vs zero is silent', () => {
    const tree = makeTree({ progress: [] })
    const { sumaPracNet, rabatClientNet } = clientTotals(tree)
    expect(sumaPracNet).toBe(0)
    expect(rabatClientNet).toBe(0)
    const verdict = reconcile(tree, [])
    expect(verdict.laborCosts.mismatch).toBe(false)
    expect(verdict.rabat.mismatch).toBe(false)
  })

  it('a de-synced LABOR_COST fires robocizna and leaves rabat silent', () => {
    const tree = makeTree()
    const txns = syncedTransactions(tree)
    // Nudge only the LABOR_COST transfer a full grosz off.
    const laborRow = txns.find((t) => t.type === 'LABOR_COST')!
    laborRow.total += 0.01
    const verdict = reconcile(tree, txns)
    expect(verdict.laborCosts.mismatch).toBe(true)
    expect(verdict.rabat.mismatch).toBe(false)
  })
})

describe('robocizna compares the PRE-rabat suma prac (EX-535 regression)', () => {
  // The bug this guards: kosztorysClientTotals summed the post-rabat section net for robocizna. Against
  // a correctly-populated investment (LABOR_COST = gross of the PRE-rabat suma prac, rabat a separate
  // transfer per `marża = robocizna − rabat − …`), that made robocizna false-fire on EVERY kosztorys
  // carrying a per-item rabat. The scream also sits on the „Suma prac wykonanych" row, whose displayed
  // value is pre-rabat — so the verdict must be about that same number.
  it('pre-rabat basis is silent; the old post-rabat basis would scream', () => {
    const tree = makeTree()
    const { sumaPracNet, rabatClientNet } = clientTotals(tree)
    expect(sumaPracNet).toBeCloseTo(140) // pre-rabat: 132 executed + 8 rabat taken
    expect(rabatClientNet).toBeCloseTo(8)

    const silent = buildKosztorysReconciliation({
      sumaPracNet,
      rabatClientNet,
      laborCostsNetFromTransactions: sumaPracNet,
      investmentRabat: rabatClientNet,
    })
    expect(silent.laborCosts.mismatch).toBe(false)

    // The old code's basis (post-rabat executed net = 132) is a different number from the pre-rabat
    // 140, so a correctly-populated LABOR_COST (the pre-rabat 140) must NOT equal it — proving the two
    // are genuinely different and the pre/post choice is load-bearing.
    const postRabatNet = sumaPracNet - rabatClientNet
    expect(postRabatNet).toBeCloseTo(132)
    expect(postRabatNet).not.toBeCloseTo(sumaPracNet)
  })
})

describe('reconciliation compares netto ↔ netto — the ledger plane carries no VAT (EX-535)', () => {
  // VAT is a client-pricing concept (prace only); LABOR_COST/RABAT transactions are netto. So a
  // kosztorys rabat of 100 reconciles against a netto RABAT of 100 — NOT a grossed 102. This is the
  // regression guard for the „rabat 100 vs 102" false-fire: we no longer gross the kosztorys side.
  // (context/reference/kosztorys-editor-domain-notes.md, „VAT dotyczy wyłącznie prac".)
  it('rabat 100 reconciles against a netto RABAT of 100, and robocizna net-to-net is silent', () => {
    const verdict = buildKosztorysReconciliation({
      sumaPracNet: 5000,
      rabatClientNet: 100,
      laborCostsNetFromTransactions: 5000,
      investmentRabat: 100,
    })
    expect(verdict.rabat.expected).toBeCloseTo(100)
    expect(verdict.rabat.mismatch).toBe(false)
    expect(verdict.laborCosts.mismatch).toBe(false)
  })

  it('a grossed RABAT (102) now FALSE-fires — proving the kosztorys side is no longer grossed', () => {
    const verdict = buildKosztorysReconciliation({
      sumaPracNet: 5000,
      rabatClientNet: 100,
      laborCostsNetFromTransactions: 5000,
      investmentRabat: 102,
    })
    expect(verdict.rabat.mismatch).toBe(true)
  })
})

describe('grosz-exact tolerance (no fuzzy epsilon)', () => {
  const base = { rabatClientNet: 0, investmentRabat: 0 }

  it('equal to the grosz → no mismatch', () => {
    const verdict = buildKosztorysReconciliation({
      ...base,
      sumaPracNet: 100,
      laborCostsNetFromTransactions: 100,
    })
    expect(verdict.laborCosts.mismatch).toBe(false)
  })

  it('a full grosz apart → mismatch', () => {
    const verdict = buildKosztorysReconciliation({
      ...base,
      sumaPracNet: 100,
      laborCostsNetFromTransactions: 100.01,
    })
    expect(verdict.laborCosts.mismatch).toBe(true)
  })

  it('sub-grosz apart (rounds to the same grosz) → no mismatch', () => {
    const verdict = buildKosztorysReconciliation({
      ...base,
      sumaPracNet: 100.002,
      laborCostsNetFromTransactions: 100.001,
    })
    expect(verdict.laborCosts.mismatch).toBe(false)
  })
})
