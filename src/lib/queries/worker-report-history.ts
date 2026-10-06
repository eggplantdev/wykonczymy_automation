import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { canViewWorkerPage, ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { listReportsByWorker, type ReportListRowT } from '@/lib/db/worker-reports'

// Uncached: a manager's decision must reach the worker's history on his next load.
export async function fetchWorkerReportHistory(workerId: number): Promise<ReportListRowT[]> {
  const session = await requireAuth(ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')
  if (!canViewWorkerPage(session.user, workerId)) throw new Error('Brak uprawnień')

  return listReportsByWorker(await getDb(await getPayload({ config })), workerId)
}
