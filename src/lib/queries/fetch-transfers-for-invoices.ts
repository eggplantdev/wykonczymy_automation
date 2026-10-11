'use server'

import type { Where } from 'payload'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchAllTransferRows } from '@/lib/queries/fetch-transfer-rows'
import { validTransferSort } from '@/lib/queries/transfer-sort'
import { withDateRange } from '@/lib/queries/transfer-filters'
import { dayBound, type ClosedDateRangeT } from '@/lib/utils/date-range'
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
  /** Replaces the table's own Od/Do. Both bounds are re-validated: this is a client-callable channel. */
  range?: ClosedDateRangeT
}

export async function fetchFilteredTransfers(
  where: Where,
  { skipMedia = false, sort, range }: FetchFilteredTransfersOptsT = {},
): Promise<ActionResultT<TransferRowT[]>> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  // A bound that fails validation must not quietly widen the archive to all time.
  if (range && (!dayBound(range.from) || !dayBound(range.to))) {
    return { success: false, error: 'Nieprawidłowy zakres dat' }
  }

  const elapsed = perfStart()
  try {
    // Cancelled rows and CANCELLATION records never leave this action (owner's ruling): they carry no
    // faktura for the ZIP, and the printout shows only live transactions even when the screen doesn't.
    const scopedWhere: Where = {
      and: [
        range ? withDateRange(where, range) : where,
        { cancelled: { not_equals: true } },
        { type: { not_equals: 'CANCELLATION' } },
      ],
    }
    const rows = await fetchAllTransferRows(scopedWhere, {
      skipMedia,
      sort: validTransferSort(sort),
    })

    console.log(`[PERF] fetchFilteredTransfers ${elapsed()}ms (${rows.length} rows)`)
    return { success: true, data: rows }
  } catch (err) {
    logError('[FETCH_TRANSFERS_FOR_INVOICES]', err)
    return toActionFailure(err)
  }
}
