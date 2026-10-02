import { describe, expect, it } from 'vitest'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { computeWorkerSummary } from '@/lib/kosztorys/worker-view/summary'
import type { KosztorysStageT, KosztorysTreeT } from '@/lib/kosztorys/types'
import type { PayoutTransactionRowT } from '@/types/transfers'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'
import { oneWorkerSplit, restHolderId } from '@/lib/kosztorys/stage-split'

const WORKER = 5
const OTHER = 9

// Worker 5 holds etapy 100 and 102 (z narzędziami, stawka 12); worker 9 holds etap 101 on the same
// plane. Row 2 carries a client rabat, which must never reach the crew's figures.
const stages: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: 'Tynki', plane: 'w_tools', split: oneWorkerSplit(WORKER) },
  { id: 101, ordinal: 2, label: null, plane: 'w_tools', split: oneWorkerSplit(OTHER) },
  { id: 102, ordinal: 3, label: null, plane: 'w_tools', split: oneWorkerSplit(WORKER) },
]
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
  stages,
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 2 },
    { itemId: 1, stageId: 101, qtyDone: 3 },
    { itemId: 2, stageId: 102, qtyDone: 1 },
  ],
  vatRate: 0.08,
})
const rows = treeToRows(tree)
const hisStages = stages.filter((stage) => restHolderId(stage.split) === WORKER)

const payout = (workerId: number | null, amount: number, date = '2026-09-01') => ({
  workerId,
  amount,
  date,
  description: 'ZUS lipiec',
})

function summarize(payoutRows: PayoutTransactionRowT[]) {
  return computeWorkerSummary({
    rows,
    stages: hisStages,
    plane: 'w_tools',
    workerId: WORKER,
    payoutRows,
  })
}

describe('computeWorkerSummary', () => {
  it('values the przedmiar at his stawka, without the client rabat', () => {
    expect(summarize([]).plannedNet).toBe((5 + 4) * 12)
  })

  it('reports executed work as exactly the figure „Podsumowanie pracowników" holds for him', () => {
    const summary = summarize([])
    const byWorker = subcontractorDueByPlane(rows, stages).byWorker.get(WORKER)

    expect(summary.executedNet).toBe(byWorker)
    expect(summary.executedNet).toBe((2 + 1) * 12)
    expect(summary.executedByStage).toEqual([
      { stageId: 100, label: 'Tynki', net: 24, wholeNet: 24, share: null },
      { stageId: 102, label: 'Etap 3', net: 12, wholeNet: 12, share: null },
    ])
  })

  it("counts only his payouts — not another worker's, not the unattributed bucket", () => {
    const summary = summarize([payout(WORKER, 10), payout(OTHER, 500), payout(null, 700)])

    expect(summary.paidNet).toBe(10)
    expect(summary.owed).toBe(26)
    expect(summary.isOverpaid).toBe(false)
  })

  it('lists his payouts with their description', () => {
    const summary = summarize([payout(WORKER, 10, '2026-09-02'), payout(OTHER, 1)])

    expect(summary.payouts).toEqual([{ date: '2026-09-02', amount: 10, description: 'ZUS lipiec' }])
  })

  it('flags an overpayment instead of reading it as a debt', () => {
    const summary = summarize([payout(WORKER, 50)])

    expect(summary.owed).toBe(-14)
    expect(summary.isOverpaid).toBe(true)
  })

  // Paying exactly the displayed należne leaves a float residue; unrounded it reads „Nadpłata -0,00".
  it('reads a paid-in-full worker as 0, not as a negative zero', () => {
    const summary = summarize([payout(WORKER, 12.1), payout(WORKER, 23.9)])

    expect(Object.is(summary.owed, 0)).toBe(true)
    expect(summary.isOverpaid).toBe(false)
  })
})

// Etap 101 (3 × 12 = 36 zł of work) shared: worker 5 on 25%, worker 9 on the rest.
describe('computeWorkerSummary — a shared etap', () => {
  const shared: KosztorysStageT = {
    ...stages[1],
    split: {
      mode: 'percent',
      members: [
        { workerId: WORKER, value: 25, takesRest: false },
        { workerId: OTHER, value: 0, takesRest: true },
      ],
    },
  }
  const summarizeShared = (workerId: number, stage = shared) =>
    computeWorkerSummary({
      rows,
      stages: [stage],
      plane: 'w_tools',
      workerId,
      payoutRows: [],
    })

  it('credits his share and shows the whole etap beside it', () => {
    const summary = summarizeShared(WORKER)

    expect(summary.executedNet).toBe(9)
    expect(summary.executedByStage).toEqual([
      { stageId: 101, label: 'Etap 2', net: 9, wholeNet: 36, share: { percent: 25, amount: 9 } },
    ])
  })

  it('gives the rest holder the effective remainder', () => {
    expect(summarizeShared(OTHER).executedByStage[0].share).toEqual({ percent: 75, amount: 27 })
  })

  it('still says the percentage before any work, with nothing to credit', () => {
    const idle = computeWorkerSummary({
      rows: treeToRows({ ...tree, progress: [] }),
      stages: [shared],
      plane: 'w_tools',
      workerId: OTHER,
      payoutRows: [],
    })

    expect(idle.executedByStage[0].share).toEqual({ percent: 75, amount: 0 })
  })

  it('names no co-worker anywhere in what it returns', () => {
    const out = JSON.stringify(summarizeShared(WORKER))

    // Worker 9's id equals worker 5's 9 zł, so the guard is on shape: no member list, no worker id,
    // and not the co-worker's 27 zł.
    expect(out).not.toMatch(/workerId|members|takesRest/)
    expect(out).not.toContain('27')
  })
})
