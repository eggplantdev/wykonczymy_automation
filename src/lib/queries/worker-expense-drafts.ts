import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { canViewWorkerPage, MANAGEMENT_ROLES, ROLES } from '@/lib/auth/roles'
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
import type { PaginationMetaT, PaginationParamsT } from '@/lib/utils/pagination'
import type { ReferenceItemT } from '@/types/reference-data'
import { managementDb } from './worker-reports-list'

// Uncached: a manager's decision must reach the worker's status list on his next load.
export async function fetchWorkerExpenseDrafts(workerId: number): Promise<ExpenseDraftRowT[]> {
  const session = await requireAuth(ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')
  if (!canViewWorkerPage(session.user, workerId)) throw new Error('Brak uprawnień')

  return listWorkerExpenseDrafts(await getDb(await getPayload({ config })), workerId)
}

// Uncached: a worker's new draft must show up on the manager's next load.
export async function fetchPendingExpenseDrafts(): Promise<ExpenseDraftRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Brak uprawnień')

  return listPendingExpenseDrafts(await getDb(await getPayload({ config })))
}

export async function fetchDraftTransferIds(transferIds: number[]): Promise<number[]> {
  const session = await requireAuth(ROLES)
  if (!session.success) throw new Error('Brak uprawnień')

  return listDraftTransferIds(await getDb(await getPayload({ config })), transferIds)
}

export type ExpenseDraftsPageT = {
  rows: ExpenseDraftRowT[]
  paginationMeta: PaginationMetaT
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
}

export async function fetchExpenseDraftsPage(
  filters: ExpenseDraftFiltersT,
  pagination: PaginationParamsT,
  sort: string | undefined,
): Promise<ExpenseDraftsPageT> {
  const db = await managementDb()
  const [{ rows, totalDocs }, options] = await Promise.all([
    listExpenseDraftHistory(db, filters, pagination, sort),
    listExpenseDraftFilterOptions(db),
  ])
  return {
    rows,
    paginationMeta: {
      currentPage: pagination.page,
      totalPages: Math.max(1, Math.ceil(totalDocs / pagination.limit)),
      totalDocs,
      limit: pagination.limit,
    },
    ...options,
  }
}
