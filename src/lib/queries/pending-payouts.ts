'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { countPendingPayouts } from '@/lib/db/payout-confirmation'

// Scoped to the session: whose badge it is is never an argument.
export async function fetchOwnPendingPayoutCount(): Promise<number> {
  const session = await requireAuth(ROLES)
  if (!session.success) return 0
  return countPendingPayouts(await getDb(await getPayload({ config })), session.user.id)
}
