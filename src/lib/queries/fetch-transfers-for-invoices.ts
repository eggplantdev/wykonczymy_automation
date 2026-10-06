'use server'

import type { Where } from 'payload'
import { requireAuth } from '@/lib/auth/require-auth'
import { canViewWorkerPage, MANAGEMENT_ROLES, ROLES } from '@/lib/auth/roles'
import { fetchAllTransferRows } from '@/lib/queries/fetch-transfer-rows'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { validTransferSort } from '@/lib/queries/transfer-sort'
import { workerPageTransferWhere } from '@/lib/queries/worker-transfers'
import { visibleWorkerRegisters } from '@/lib/workers/owned-registers'
import type { TransferRowT } from '@/types/transfers'
import type { ActionResultT } from '@/types/action'
import { toActionFailure } from '@/lib/actions/action-failure'
import { logError } from '@/lib/utils/log-error'
import { perfStart } from '@/lib/perf'

type FetchFilteredTransfersOptsT = {
  /** Skip resolving invoice media for callers that never render it. */
  skipMedia?: boolean
  /** The printout passes the screen's own key here so the two cannot disagree. Re-validated against
   * the same whitelist the pages use, because this is a client-callable channel. */
  sort?: string
}

export async function fetchFilteredTransfers(
  where: Where,
  opts: FetchFilteredTransfersOptsT = {},
): Promise<ActionResultT<TransferRowT[]>> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  return fetchLiveTransferRows('fetchFilteredTransfers', where, opts)
}

/**
 * The worker page's channel. It takes the URL params, never a `Where`: the scope is rebuilt here
 * from the session, because this one is open to an EMPLOYEE (lessons: never accept a client `Where`
 * in an action for a wider audience).
 */
export async function fetchWorkerTransfers(
  workerId: number,
  params: Record<string, string>,
  opts: FetchFilteredTransfersOptsT = {},
): Promise<ActionResultT<TransferRowT[]>> {
  const session = await requireAuth(ROLES)
  if (!session.success) return session
  const { user } = session
  if (!canViewWorkerPage(user, workerId)) return { success: false, error: 'Brak uprawnień' }

  const refData = await fetchReferenceData()
  const registers = visibleWorkerRegisters(refData.cashRegisters, workerId, user.role)
  const where = workerPageTransferWhere(
    params,
    user.id,
    workerId,
    registers.map((register) => register.id),
  )

  return fetchLiveTransferRows('fetchWorkerTransfers', where, opts)
}

async function fetchLiveTransferRows(
  label: string,
  where: Where,
  { skipMedia = false, sort }: FetchFilteredTransfersOptsT,
): Promise<ActionResultT<TransferRowT[]>> {
  const elapsed = perfStart()
  try {
    // Cancelled rows and CANCELLATION records never leave this action (owner's ruling): they carry no
    // faktura for the ZIP, and the printout shows only live transactions even when the screen doesn't.
    const scopedWhere: Where = {
      and: [where, { cancelled: { not_equals: true } }, { type: { not_equals: 'CANCELLATION' } }],
    }
    const rows = await fetchAllTransferRows(scopedWhere, {
      skipMedia,
      sort: validTransferSort(sort),
    })

    console.log(`[PERF] ${label} ${elapsed()}ms (${rows.length} rows)`)
    return { success: true, data: rows }
  } catch (err) {
    logError('[FETCH_TRANSFERS_FOR_INVOICES]', err)
    return toActionFailure(err)
  }
}
