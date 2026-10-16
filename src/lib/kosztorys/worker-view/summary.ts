import { rowCurrentPlannedNetForView } from '@/lib/kosztorys/calc'
import { formatPercent } from '@/lib/kosztorys/format'
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
  plannedNet: number
  executedByStage: WorkerStageLineT[]
  stagesWholeNet: number
  executedNet: number
  bonusNet: number
  payouts: WorkerPayoutT[]
  paidNet: number
  owed: number
  isOverpaid: boolean
}

export type WorkerPayoutT = Omit<PayoutTransactionRowT, 'workerId' | 'type'>

export type WorkerStageShareT = { percent: number | null; amount: number }

// `label` stays raw: each surface names an unnamed etap in its own language (`stageLabel`).
export type WorkerStageLineT = Pick<KosztorysStageT, 'label' | 'ordinal'> & {
  stageId: number
  net: number
  wholeNet: number
  // Null on a one-person etap. Carries no co-worker id, name or amount.
  share: WorkerStageShareT | null
}

export type WorkerSummaryInputT = {
  rows: KosztorysV2RowT[]
  stages: KosztorysStageT[]
  plane: ToolPlaneT
  workerId: number
  payoutRows: PayoutTransactionRowT[]
}

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
    plannedNet: rows.reduce((sum, row) => sum + rowCurrentPlannedNetForView(row, plane), 0),
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
  if (split.mode === 'amount') return { percent: null, amount }
  // A percent split of 100 comes out as the percentages themselves.
  return { percent: splitStagePool(100, split).shares.get(workerId) ?? 0, amount }
}

export function stageShareLabel(line: WorkerStageLineT): string {
  if (!line.share) return formatPercent(1)
  return line.share.percent == null ? '—' : formatPercent(line.share.percent / 100)
}
