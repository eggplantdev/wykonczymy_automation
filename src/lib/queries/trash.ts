import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { TRASH_RETENTION_DAYS } from '@/lib/constants/investment-lock'
import { fetchTrashedInvestments, type TrashedInvestmentRowT } from '@/lib/db/investment-trash'

const DAY_MS = 24 * 60 * 60 * 1000

export type TrashedInvestmentT = TrashedInvestmentRowT & {
  /** Whole days until the cron purges it — unless a used kosztorys keeps it for a manual delete. */
  daysLeft: number
}

// Uncached: the page is rare, and its „used" flag reads kosztorys tables no trash tag covers.
export async function getTrashedInvestments(): Promise<TrashedInvestmentT[]> {
  const session = await requireAuth(ADMIN_OR_OWNER_ROLES)
  if (!session.success) throw new Error(session.error)

  const payload = await getPayload({ config })
  const rows = await fetchTrashedInvestments(await getDb(payload))
  const now = Date.now()

  return rows.map((row) => ({
    ...row,
    daysLeft: Math.max(
      0,
      Math.ceil((row.trashedAt.getTime() + TRASH_RETENTION_DAYS * DAY_MS - now) / DAY_MS),
    ),
  }))
}
