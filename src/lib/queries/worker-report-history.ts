import 'server-only'
import { listReportsByWorker, type ReportListRowT } from '@/lib/db/worker-reports'
import { workerPageDb } from '@/lib/queries/worker-page-db'

// Uncached: a manager's decision must reach the worker's history on his next load.
export async function fetchWorkerReportHistory(workerId: number): Promise<ReportListRowT[]> {
  return listReportsByWorker(await workerPageDb(workerId), workerId)
}
