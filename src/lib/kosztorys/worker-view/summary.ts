import { rowPlannedNetForView } from '@/lib/kosztorys/calc'
import { formatPercentPrecise } from '@/lib/kosztorys/format'
import { splitStagePool } from '@/lib/kosztorys/stage-split'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import type {
  KosztorysStageT,
  KosztorysV2RowT,
  StageSplitT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { PayoutTransactionRowT } from '@/types/transfers'

export type WorkerSummaryT = {
  // What the whole przedmiar earns him: przedmiar × his stawka, no rabat (a client concession).
  plannedNet: number
  executedByStage: WorkerStageLineT[]
  // Σ of his etapy whole, co-workers included — the „Wartość etapu" column's total.
  stagesWholeNet: number
  executedNet: number
  // Σ his premii — one line, not itemised: a premia is owed on top of the work, not paid.
  bonusNet: number
  payouts: WorkerPayoutT[]
  paidNet: number
  // executed + premia − paid; negative is an overpayment, rendered as „Nadpłata" rather than a minus.
  owed: number
  isOverpaid: boolean
}

export type WorkerPayoutT = Omit<PayoutTransactionRowT, 'workerId' | 'type'>

// His share of a shared etap. `amount` is what he is credited — after any pro-rata shrink — and
// `percent` is that amount's part of the whole etap; null where an amount split has no pool yet.
export type WorkerStageShareT = { percent: number | null; amount: number }

// `label` stays raw: each surface names an unnamed etap in its own language (`stageLabel`).
export type WorkerStageLineT = Pick<KosztorysStageT, 'label' | 'ordinal'> & {
  stageId: number
  // His share — the figure his „Wykonane razem" sums.
  net: number
  // The whole etap, every co-worker included. Equal to `net` on a one-person etap.
  wholeNet: number
  // Null on a one-person etap. Carries no co-worker id, name or amount.
  share: WorkerStageShareT | null
}

export type WorkerSummaryInputT = {
  rows: KosztorysV2RowT[]
  // His etapy only — `resolveWorkerScope`'s `stages`.
  stages: KosztorysStageT[]
  plane: ToolPlaneT
  workerId: number
  // Every payout on the investment; the worker's own are picked here, off the same rows
  // „Podsumowanie pracowników" groups (payouts-by-worker.ts forbids a second query).
  payoutRows: PayoutTransactionRowT[]
}

/**
 * The worker view's summary block. Executed work is read off `subcontractorDueByPlane` rather than
 * re-derived, so the worker's „wykonane" is the very figure the owner sees on his line of
 * „Podsumowanie pracowników" — a second derivation is a second answer the day either one changes.
 */
export function computeWorkerSummary({
  rows,
  stages,
  plane,
  workerId,
  payoutRows,
}: WorkerSummaryInputT): WorkerSummaryT {
  const due = subcontractorDueByPlane(rows, stages)
  const executedNet = due.byWorker.get(workerId) ?? 0
  const workerRows = payoutRows.filter((row) => row.workerId === workerId)
  const payouts = workerRows
    .filter((row) => row.type === 'PAYOUT')
    .map(({ date, amount, description }) => ({ date, amount, description }))
  const paidNet = roundToCents(payouts.reduce((sum, row) => sum + row.amount, 0))
  const bonusNet = roundToCents(
    workerRows.reduce((sum, row) => (row.type === 'BONUS' ? sum + row.amount : sum), 0),
  )
  const owed = roundToCents(executedNet + bonusNet - paidNet)
  const executedByStage = stages.map((stage) => {
    const wholeNet = due.byStage.get(stage.id) ?? 0
    const net = due.byStageWorker.get(stage.id)?.get(workerId) ?? 0
    return {
      stageId: stage.id,
      label: stage.label,
      ordinal: stage.ordinal,
      net,
      wholeNet,
      share: shareOf(stage.split, workerId, wholeNet, net),
    }
  })
  return {
    plannedNet: rows.reduce((sum, row) => sum + rowPlannedNetForView(row, plane), 0),
    executedByStage,
    stagesWholeNet: roundToCents(executedByStage.reduce((sum, stage) => sum + stage.wholeNet, 0)),
    executedNet,
    bonusNet,
    payouts,
    paidNet,
    owed,
    isOverpaid: owed < 0,
  }
}

function shareOf(
  split: StageSplitT | null,
  workerId: number,
  wholeNet: number,
  amount: number,
): WorkerStageShareT | null {
  if (!split || split.members.length < 2) return null
  if (wholeNet > 0) return { percent: (amount / wholeNet) * 100, amount }
  // No executed work yet: a percent split still says what he will get, an amount split can't.
  if (split.mode === 'amount') return { percent: null, amount }
  // A percent split of 100 comes out as the percentages themselves.
  return { percent: splitStagePool(100, split).shares.get(workerId) ?? 0, amount }
}

/**
 * The „Twój udział" cell of one etap, shared by the link and the PDF so the two read alike. A
 * one-person etap is all his; an amount split with no executed work yet has no percent to show.
 */
export function stageShareLabel(line: WorkerStageLineT): string {
  if (!line.share) return formatPercentPrecise(1)
  return line.share.percent == null ? '—' : formatPercentPrecise(line.share.percent / 100)
}
