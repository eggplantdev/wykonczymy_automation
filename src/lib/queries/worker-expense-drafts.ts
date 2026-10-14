import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import {
  listAllDraftTransferIds,
  listDraftTransferIds,
  listExpenseDraftFilterOptions,
  listExpenseDraftHistory,
  listPendingExpenseDrafts,
  listWorkerExpenseDrafts,
  type ExpenseDraftFiltersT,
  type ExpenseDraftRowT,
} from '@/lib/db/worker-expense-drafts'
import { managementDb } from '@/lib/queries/management-db'
import { workerPageDb } from '@/lib/queries/worker-page-db'
import { paginationMetaFromCount, type PaginationParamsT } from '@/lib/utils/pagination'
import type { QueuePageT } from '@/types/filters'

// Uncached: a manager's decision must reach the worker's status list on his next load.
export async function fetchWorkerExpenseDrafts(workerId: number): Promise<ExpenseDraftRowT[]> {
  return listWorkerExpenseDrafts(await workerPageDb(workerId), workerId)
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

/** Every transfer a draft was booked as — unscoped, so management only. */
export async function fetchAllDraftTransferIds(): Promise<number[]> {
  return listAllDraftTransferIds(await managementDb())
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
