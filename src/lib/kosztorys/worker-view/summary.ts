import { rowPlannedNetForView } from '@/lib/kosztorys/calc'
import { formatPercentPrecise } from '@/lib/kosztorys/format'
import { stageLabel } from '@/lib/kosztorys/stage-label'
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
  executedNet: number
  // Date and amount only: a payout's description is often an internal note (design #10).
  payouts: { date: string; amount: number }[]
  paidNet: number
  // executed − paid; negative is an overpayment, rendered as „Nadpłata" rather than a minus.
  owed: number
  isOverpaid: boolean
}

// His share of a shared etap. `amount` is what he is credited — after any pro-rata shrink — and
// `percent` is that amount's part of the whole etap; null where an amount split has no pool yet.
export type WorkerStageShareT = { percent: number | null; amount: number }

export type WorkerStageLineT = {
  stageId: number
  label: string
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
  const payouts = payoutRows
    .filter((row) => row.workerId === workerId)
    .map(({ date, amount }) => ({ date, amount }))
  const paidNet = roundToCents(payouts.reduce((sum, row) => sum + row.amount, 0))
  const owed = roundToCents(executedNet - paidNet)
  return {
    plannedNet: rows.reduce((sum, row) => sum + rowPlannedNetForView(row, plane), 0),
    executedByStage: stages.map((stage) => {
      const wholeNet = due.byStage.get(stage.id) ?? 0
      const net = due.byStageWorker.get(stage.id)?.get(workerId) ?? 0
      return {
        stageId: stage.id,
        label: stageLabel(stage),
        net,
        wholeNet,
        share: shareOf(stage.split, workerId, wholeNet, net),
      }
    }),
    executedNet,
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
  const member = split.members.find((candidate) => candidate.workerId === workerId)
  const othersPercent = split.members
    .filter((candidate) => !candidate.takesRest)
    .reduce((total, candidate) => total + candidate.value, 0)
  return { percent: member?.takesRest ? 100 - othersPercent : (member?.value ?? 0), amount }
}

/**
 * The footer lines one etap contributes, shared by the link and the PDF so the two read alike. A
 * shared etap names the whole etap and his share on separate lines — the rows above it are the
 * whole etap's, so a single line with his share would not match them.
 */
export function stageLines(line: WorkerStageLineT): { label: string; amount: number }[] {
  if (!line.share) return [{ label: line.label, amount: line.net }]
  const percent =
    line.share.percent == null ? '' : `: ${formatPercentPrecise(line.share.percent / 100)}`
  return [
    { label: `${line.label} (cały etap)`, amount: line.wholeNet },
    { label: `Twój udział${percent}`, amount: line.share.amount },
  ]
}
