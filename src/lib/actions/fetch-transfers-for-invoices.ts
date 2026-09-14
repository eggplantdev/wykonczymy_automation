'use server'

import type { Where } from 'payload'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchAllTransferRows } from '@/lib/queries/fetch-transfer-rows'
import type { TransferRowT } from '@/types/transfers'
import type { ActionResultT } from '@/types/action'
import { getErrorMessage } from '@/lib/actions/run-action'
import { perfStart } from '@/lib/perf'

type FetchFilteredTransfersOptsT = {
  /** Skip resolving invoice media for callers that never render it. */
  skipMedia?: boolean
}

export async function fetchFilteredTransfers(
  where: Where,
  { skipMedia = false }: FetchFilteredTransfersOptsT = {},
): Promise<ActionResultT<TransferRowT[]>> {
  const elapsed = perfStart()

  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    // Cancelled rows and CANCELLATION records never leave this action — owner's ruling, for both
    // consumers: they carry no faktura for the ZIP, and the printout deliberately shows only live
    // transactions even when the screen's own filter is showing them.
    const scopedWhere: Where = {
      and: [where, { cancelled: { not_equals: true } }, { type: { not_equals: 'CANCELLATION' } }],
    }
    const rows = await fetchAllTransferRows(scopedWhere, { skipMedia })

    console.log(`[PERF] fetchFilteredTransfers ${elapsed()}ms (${rows.length} rows)`)
    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}
