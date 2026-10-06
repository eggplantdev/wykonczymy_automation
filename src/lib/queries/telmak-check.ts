'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { loadTelmakCheckRows } from '@/lib/db/telmak-check'
import { fetchAllTransferRows } from '@/lib/queries/fetch-transfer-rows'
import type { TelmakAppRowT } from '@/lib/telmak/compare-telmak'
import type { TransferRowT } from '@/types/transfers'

export async function fetchTelmakCheckRows(
  registerId: number,
  from: string,
  to: string,
  numbers: string[],
): Promise<TelmakAppRowT[]> {
  const [session, payload] = await Promise.all([
    requireAuth(MANAGEMENT_ROLES),
    getPayload({ config }),
  ])
  if (!session.success) throw new Error(session.error)
  return loadTelmakCheckRows(await getDb(payload), { registerId, from, to, numbers })
}

export async function fetchTelmakTransferRows(ids: number[]): Promise<TransferRowT[]> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)
  if (ids.length === 0) return []
  return fetchAllTransferRows({ id: { in: ids } })
}
