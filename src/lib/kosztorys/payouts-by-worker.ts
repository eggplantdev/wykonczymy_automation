import { roundToCents } from '@/lib/utils/round-to-cents'
import type { WorkerRefT } from '@/types/reference-data'
import type { PayoutTransactionRowT, SubcontractorPayoutRowT } from '@/types/transfers'

export const UNASSIGNED_WORKER_NAME = 'Bez przypisanego pracownika'

export function resolveWorkerName(
  workerId: number | null,
  nameById: ReadonlyMap<number, string>,
  resolved?: string,
): string {
  if (workerId === null) return UNASSIGNED_WORKER_NAME
  return resolved ?? nameById.get(workerId) ?? 'Nieznany pracownik'
}

/**
 * Within one investment's subcontractor block, never re-split this into its own `GROUP BY worker_id`
 * query: a second cache entry over the same WHERE can serve the block's totals from a different
 * snapshot than the list beneath them.
 */
export function derivePayoutsByWorker(
  rows: PayoutTransactionRowT[],
  workers: WorkerRefT[],
): SubcontractorPayoutRowT[] {
  const nameById = new Map(workers.map((worker) => [worker.id, worker.name]))
  const sumsByWorker = new Map<number | null, { total: number; bonus: number }>()
  for (const row of rows) {
    const sums = sumsByWorker.get(row.workerId) ?? { total: 0, bonus: 0 }
    if (row.type === 'BONUS') sums.bonus += row.amount
    else sums.total += row.amount
    sumsByWorker.set(row.workerId, sums)
  }

  return [...sumsByWorker].map(([workerId, { total, bonus }]) => ({
    workerId,
    total: roundToCents(total),
    bonus: roundToCents(bonus),
    name: resolveWorkerName(workerId, nameById),
  }))
}
