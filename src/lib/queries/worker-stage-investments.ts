import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { canViewWorkerPage, ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { listWorkerStageInvestments, type WorkerStageInvestmentT } from '@/lib/db/stage-memberships'

// Uncached: each row carries a live report token, and a rotation must reach the page on the next load.
export async function fetchWorkerStageInvestments(
  workerId: number,
): Promise<WorkerStageInvestmentT[]> {
  const session = await requireAuth(ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')
  if (!canViewWorkerPage(session.user, workerId)) throw new Error('Brak uprawnień')

  return listWorkerStageInvestments(await getDb(await getPayload({ config })), workerId)
}
