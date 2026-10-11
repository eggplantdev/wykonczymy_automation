import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { canViewWorkerPage, ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'

// The read gate of `/pracownicy/[id]`: management, or the worker on his own page.
export async function workerPageDb(workerId: number) {
  const session = await requireAuth(ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')
  if (!canViewWorkerPage(session.user, workerId)) throw new Error('Brak uprawnień')
  return getDb(await getPayload({ config }))
}
