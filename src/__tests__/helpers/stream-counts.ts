import type { Payload } from 'payload'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import {
  unreadFleetDeadlinesSql,
  unreadLeadsSql,
  unreadWarrantiesSql,
} from '@/lib/db/notifications'
import { REJECTED_RECEIPTS_COUNT } from '@/lib/db/receipt-confirmation'
import { PENDING_EXPENSE_DRAFTS_COUNT } from '@/lib/db/worker-expense-drafts'
import { PENDING_REPORTS_COUNT } from '@/lib/db/worker-reports'
import type { SqlT } from '@/lib/db/sql-list'

async function countOf(db: DbExecutorT, query: SqlT): Promise<number> {
  const result = await db.execute(query)
  return Number(result.rows[0]?.count ?? result.rows[0]?.total ?? 0)
}

export const countUnreadLeads = async (payload: Payload, userId: number) =>
  countOf(await getDb(payload), unreadLeadsSql(userId))

export const countUnreadFleetDeadlines = async (payload: Payload, userId: number, today: string) =>
  countOf(await getDb(payload), unreadFleetDeadlinesSql(userId, today))

export const countUnreadWarranties = async (payload: Payload, userId: number, today: string) =>
  countOf(await getDb(payload), unreadWarrantiesSql(userId, today))

export const countRejectedReceipts = (db: DbExecutorT) => countOf(db, REJECTED_RECEIPTS_COUNT)

export const countPendingExpenseDrafts = (db: DbExecutorT) =>
  countOf(db, PENDING_EXPENSE_DRAFTS_COUNT)

export const countPendingReports = (db: DbExecutorT) => countOf(db, PENDING_REPORTS_COUNT)
