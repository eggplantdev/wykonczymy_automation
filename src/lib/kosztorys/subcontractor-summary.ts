import { resolveWorkerName } from '@/lib/kosztorys/payouts-by-worker'
import { roundToCents } from '@/lib/utils/round-to-cents'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'
import type { SubcontractorPayoutRowT } from '@/types/transfers'

export type WorkerSettlementStateT =
  | 'settled'
  | 'overpaid'
  | 'no_stages'
  | 'no_executed_work'
  | 'unattributed'

export type SubcontractorWorkerRowT = {
  workerId: number | null
  name: string
  // Executed value of this worker's etapy, pre-rabat at each etap's own plane.
  due: number
  bonus: number
  paid: number
  remaining: number
  state: WorkerSettlementStateT
}

export type SubcontractorSummaryInputT = {
  byWorker?: Map<number | null, number>
  stages?: KosztorysStageT[]
  workers?: WorkerRefT[]
}

export type SubcontractorSummaryT = {
  dueNet: number
  bonusTotal: number
  payoutsTotal: number
  remaining: number
  rows: SubcontractorWorkerRowT[]
}

function settlementState(
  workerId: number | null,
  owed: number,
  remaining: number,
  hasStages: boolean,
): WorkerSettlementStateT {
  if (workerId === null) return 'unattributed'
  if (remaining >= 0) return 'settled'
  if (owed > 0) return 'overpaid'
  return hasStages ? 'no_executed_work' : 'no_stages'
}

/**
 * The headline totals stay investment-level and are NOT Σ rows: `dueNet` is passed in from the
 * settlement's `combined` so the headline can't drift from the split even mid-edit.
 */
export function computeSubcontractorSummary(
  dueNet: number,
  payouts: SubcontractorPayoutRowT[],
  { byWorker = new Map(), stages = [], workers = [] }: SubcontractorSummaryInputT = {},
): SubcontractorSummaryT {
  const payoutsTotal = payouts.reduce((sum, row) => sum + row.total, 0)
  const bonusTotal = payouts.reduce((sum, row) => sum + row.bonus, 0)
  const payoutByWorker = new Map(payouts.map((row) => [row.workerId, row]))
  const nameById = new Map(workers.map((worker) => [worker.id, worker.name]))
  // From `stages`, NOT from `byWorker`: an etap with no rozliczenie is skipped before the settlement
  // credits anyone, so a worker holding only plane-less etapy is absent from `byWorker` while being
  // very much assigned.
  const assignedWorkerIds = new Set<number | null>(
    stages.flatMap((stage) => stage.split?.members.map((member) => member.workerId) ?? [null]),
  )

  const workerIds = new Set<number | null>([
    ...payoutByWorker.keys(),
    ...byWorker.keys(),
    ...assignedWorkerIds,
  ])
  const rows: SubcontractorWorkerRowT[] = [...workerIds]
    .map((workerId) => {
      const payout = payoutByWorker.get(workerId)
      const due = byWorker.get(workerId) ?? 0
      const paid = payout?.total ?? 0
      const bonus = payout?.bonus ?? 0
      // `due` is Σ qty × viewPrice through fractional plane coefficients while `paid` is a raw
      // Postgres SUM, so paying out exactly the displayed należne leaves the two differing by ~1e-13.
      const remaining = roundToCents(due + bonus - paid)
      return {
        workerId,
        name: resolveWorkerName(workerId, nameById, payout?.name),
        due,
        bonus,
        paid,
        remaining,
        state: settlementState(workerId, due + bonus, remaining, assignedWorkerIds.has(workerId)),
      }
    })
    .filter((row) => row.workerId !== null || row.due !== 0 || row.bonus !== 0 || row.paid !== 0)

  rows.sort((a, b) => {
    if (a.workerId === null) return 1
    if (b.workerId === null) return -1
    return b.remaining - a.remaining
  })

  return {
    dueNet,
    bonusTotal,
    payoutsTotal,
    remaining: roundToCents(dueNet + bonusTotal - payoutsTotal),
    rows,
  }
}

export type SubcontractorRowTotalsT = {
  due: number
  bonus: number
  paid: number
  remaining: number
}

/**
 * Summed at full precision and rounded ONCE. Each row is already rounded to the grosz, so adding the
 * rows up collects half a grosz per person.
 */
export function subcontractorRowTotals(rows: SubcontractorWorkerRowT[]): SubcontractorRowTotalsT {
  const due = rows.reduce((sum, row) => sum + row.due, 0)
  const bonus = rows.reduce((sum, row) => sum + row.bonus, 0)
  const paid = rows.reduce((sum, row) => sum + row.paid, 0)
  return {
    due: roundToCents(due),
    bonus: roundToCents(bonus),
    paid: roundToCents(paid),
    remaining: roundToCents(due + bonus - paid),
  }
}
