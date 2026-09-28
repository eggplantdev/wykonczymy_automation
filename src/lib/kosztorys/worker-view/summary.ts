import { rowPlannedNetForView } from '@/lib/kosztorys/calc'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import type { KosztorysStageT, KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { PayoutTransactionRowT } from '@/types/transfers'

export type WorkerSummaryT = {
  // „Ile zarobi, jeśli zrobi cały przedmiar" — przedmiar × his stawka, no rabat (a client concession).
  plannedNet: number
  executedByStage: { stageId: number; label: string; net: number }[]
  executedNet: number
  // Date and amount only: a payout's description is often an internal note (design #10).
  payouts: { date: string; amount: number }[]
  paidNet: number
  // executed − paid; negative is an overpayment, rendered as „Nadpłata" rather than a minus.
  owed: number
  isOverpaid: boolean
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
    executedByStage: stages.map((stage) => ({
      stageId: stage.id,
      label: stageLabel(stage),
      net: due.byStage.get(stage.id) ?? 0,
    })),
    executedNet,
    payouts,
    paidNet,
    owed,
    isOverpaid: owed < 0,
  }
}
