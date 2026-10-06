import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'

// Uncached: a report or draft decided a second ago in another window must already read as decided.
export async function managementDb() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)
  return getDb(await getPayload({ config }))
}
