import 'server-only'
import { listWorkerStageInvestments, type WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import { workerPageDb } from '@/lib/queries/worker-page-db'

// Uncached: each row carries a live report token, and a rotation must reach the page on the next load.
export async function fetchWorkerStageInvestments(
  workerId: number,
): Promise<WorkerStageInvestmentT[]> {
  return listWorkerStageInvestments(await workerPageDb(workerId), workerId)
}
