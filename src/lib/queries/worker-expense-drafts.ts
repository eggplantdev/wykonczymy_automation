import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { canViewWorkerPage, ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import {
  listDraftTransferIds,
  listExpenseDraftFilterOptions,
  listExpenseDraftHistory,
  listPendingExpenseDrafts,
  listWorkerExpenseDrafts,
  type ExpenseDraftFiltersT,
  type ExpenseDraftRowT,
} from '@/lib/db/worker-expense-drafts'
import { managementDb } from '@/lib/queries/management-db'
import { paginationMetaFromCount, type PaginationParamsT } from '@/lib/utils/pagination'
import type { QueuePageT } from '@/types/filters'

// Uncached: a manager's decision must reach the worker's status list on his next load.
export async function fetchWorkerExpenseDrafts(workerId: number): Promise<ExpenseDraftRowT[]> {
  const session = await requireAuth(ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')
  if (!canViewWorkerPage(session.user, workerId)) throw new Error('Brak uprawnień')

  return listWorkerExpenseDrafts(await getDb(await getPayload({ config })), workerId)
}

// Uncached: a worker's new draft must show up on the manager's next load.
export async function fetchPendingExpenseDrafts(): Promise<ExpenseDraftRowT[]> {
  return listPendingExpenseDrafts(await managementDb())
}

export async function fetchDraftTransferIds(transferIds: number[]): Promise<number[]> {
  const session = await requireAuth(ROLES)
  if (!session.success) throw new Error('Brak uprawnień')

  return listDraftTransferIds(await getDb(await getPayload({ config })), transferIds)
}

export async function fetchExpenseDraftsPage(
  filters: ExpenseDraftFiltersT,
  pagination: PaginationParamsT,
  sort: string | undefined,
): Promise<QueuePageT<ExpenseDraftRowT>> {
  const db = await managementDb()
  const [{ rows, totalDocs }, options] = await Promise.all([
    listExpenseDraftHistory(db, filters, pagination, sort),
    listExpenseDraftFilterOptions(db),
  ])
  return {
    rows,
    paginationMeta: paginationMetaFromCount(totalDocs, pagination),
    ...options,
  }
}
