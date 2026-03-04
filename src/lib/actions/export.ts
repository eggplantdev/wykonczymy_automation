'use server'

import type { Where } from 'payload'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchAllTransferRows } from '@/lib/queries/fetch-transfer-rows'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { ActionResultT } from '@/lib/actions/utils'
import { getErrorMessage } from '@/lib/actions/utils'
import { perfStart } from '@/lib/perf'

export async function fetchFilteredTransfers(where: Where): Promise<ActionResultT<TransferRowT[]>> {
  const elapsed = perfStart()

  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const rows = await fetchAllTransferRows(where)

    console.log(`[PERF] fetchFilteredTransfers ${elapsed()}ms (${rows.length} rows)`)
    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}
