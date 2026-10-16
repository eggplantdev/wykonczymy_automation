import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getDb } from '@/lib/db/get-db'
import { countShellBadges } from '@/lib/db/shell-badge-counts'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/roles'
import { warsawToday } from '@/lib/utils/days'
import type { UnreadCountsT } from '@/types/notifications'

const NONE: UnreadCountsT = {
  leads: 0,
  fleet: 0,
  equipment: 0,
  workerReports: 0,
  expenseDrafts: 0,
  rejectedPayouts: 0,
}

/**
 * Reads the session itself rather than taking a `userId`/`role` pair: a caller-supplied identity is one
 * `'use server'` away from letting the browser ask for anyone's counts. `getCurrentUserJwt` is
 * React-cached, so the shell's own call already paid for this one.
 *
 * React-cached because Next renders the root layout twice per request — once more as the root
 * not-found fallback it serializes eagerly — and both copies of the shell ask for the counts.
 */
export const fetchUnreadCounts = cache(async (): Promise<UnreadCountsT> => {
  const user = await getCurrentUserJwt()
  if (!user || !isManagementRole(user.role)) return NONE

  const db = await getDb(await getPayload({ config }))
  return countShellBadges(db, user.id, warsawToday())
})
