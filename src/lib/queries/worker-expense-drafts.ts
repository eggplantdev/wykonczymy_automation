import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { canViewWorkerPage, MANAGEMENT_ROLES, ROLES } from '@/lib/auth/roles'
import { REJECTED_DRAFTS_LIMIT } from '@/lib/constants/worker-expense-drafts'
import { getDb } from '@/lib/db/get-db'
import {
  listDraftTransferIds,
  listPendingExpenseDrafts,
  listRejectedExpenseDrafts,
  listWorkerExpenseDrafts,
  type ExpenseDraftRowT,
  type RejectedDraftScopeT,
} from '@/lib/db/worker-expense-drafts'

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

export async function fetchRejectedExpenseDrafts(
  scope: RejectedDraftScopeT,
): Promise<ExpenseDraftRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error('Brak uprawnień')

  return listRejectedExpenseDrafts(
    await getDb(await getPayload({ config })),
    REJECTED_DRAFTS_LIMIT,
    scope,
  )
}

export async function fetchDraftTransferIds(transferIds?: number[]): Promise<number[]> {
  const session = await requireAuth(ROLES)
  if (!session.success) throw new Error('Brak uprawnień')

  return listDraftTransferIds(await getDb(await getPayload({ config })), transferIds)
}
