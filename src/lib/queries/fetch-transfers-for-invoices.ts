'use server'

import type { Where } from 'payload'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchAllTransferRows } from '@/lib/queries/fetch-transfer-rows'
import { validTransferSort } from '@/lib/queries/transfer-sort'
import { withDateRange } from '@/lib/queries/transfer-filters'
import { isClosedRange, type ClosedDateRangeT } from '@/lib/utils/date-range'
import type { TransferRowT } from '@/types/transfers'
import type { ActionResultT } from '@/types/action'
import { toActionFailure } from '@/lib/actions/action-failure'
import { logError } from '@/lib/utils/log-error'
import { perfStart } from '@/lib/perf'

export type FetchFilteredTransfersOptsT = {
  skipMedia?: boolean
  sort?: string
  range?: ClosedDateRangeT
}

export async function fetchFilteredTransfers(
  where: Where,
  { skipMedia = false, sort, range }: FetchFilteredTransfersOptsT = {},
): Promise<ActionResultT<TransferRowT[]>> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  // Refused rather than queried: a junk or inverted bound comes back as an empty archive, which reads
  // exactly like a month with no faktury.
  if (range && !isClosedRange(range)) {
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
