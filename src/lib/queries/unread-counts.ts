import { getPayload } from 'payload'
import config from '@payload-config'
import {
  countUnreadFleetDeadlines,
  countUnreadLeads,
  countUnreadWarranties,
} from '@/lib/db/notifications'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/roles'
import { warsawToday } from '@/lib/utils/days'
import type { UnreadCountsT } from '@/types/notifications'

const NONE: UnreadCountsT = { leads: 0, fleet: 0, equipment: 0 }

/**
 * Reads the session itself rather than taking a `userId`/`role` pair: a caller-supplied identity is one
 * `'use server'` away from letting the browser ask for anyone's counts. `getCurrentUserJwt` is
 * React-cached, so the shell's own call already paid for this one.
 */
export async function fetchUnreadCounts(): Promise<UnreadCountsT> {
  const user = await getCurrentUserJwt()
  if (!user || !isManagementRole(user.role)) return NONE

  const payload = await getPayload({ config })
  const today = warsawToday()

  const [leads, fleet, equipment] = await Promise.all([
    countUnreadLeads(payload, user.id),
    countUnreadFleetDeadlines(payload, user.id, today),
    countUnreadWarranties(payload, user.id, today),
  ])

  return { leads, fleet, equipment }
}
