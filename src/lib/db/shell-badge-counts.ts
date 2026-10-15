import { sql } from '@payloadcms/db-postgres'
import type { UnreadCountsT } from '@/types/notifications'
import type { DbExecutorT } from './get-db'
import { unreadFleetDeadlinesSql, unreadLeadsSql, unreadWarrantiesSql } from './notifications'
import { REJECTED_PAYOUTS_COUNT } from './payout-confirmation'
import { PENDING_EXPENSE_DRAFTS_COUNT } from './worker-expense-drafts'
import { PENDING_REPORTS_COUNT } from './worker-reports'

/**
 * Every nav badge in one statement. The shell runs on every management request, and six parallel
 * counts took six of the pool's ten connections before the page's own queries could start.
 */
export async function countShellBadges(
  db: DbExecutorT,
  userId: number,
  today: string,
): Promise<UnreadCountsT> {
  const res = await db.execute(sql`
    SELECT
      (${unreadLeadsSql(userId)})::int AS leads,
      (${unreadFleetDeadlinesSql(userId, today)})::int AS fleet,
      (${unreadWarrantiesSql(userId, today)})::int AS equipment,
      (${PENDING_REPORTS_COUNT}) AS worker_reports,
      (${PENDING_EXPENSE_DRAFTS_COUNT}) AS expense_drafts,
      (${REJECTED_PAYOUTS_COUNT}) AS rejected_payouts
  `)
  const row = res.rows[0] ?? {}
  return {
    leads: Number(row.leads ?? 0),
    fleet: Number(row.fleet ?? 0),
    equipment: Number(row.equipment ?? 0),
    workerReports: Number(row.worker_reports ?? 0),
    expenseDrafts: Number(row.expense_drafts ?? 0),
    rejectedPayouts: Number(row.rejected_payouts ?? 0),
  }
}
