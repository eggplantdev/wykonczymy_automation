import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { perfStart } from '@/lib/perf'
import type { RawTransferDocT } from '@/lib/queries/transfers'

/** Fetches ALL matching transfers (no pagination) for export. Not cached. */
export async function findAllTransfersForExport(where: Where): Promise<RawTransferDocT[]> {
  const elapsed = perfStart()
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'transactions',
    where,
    sort: '-date',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  console.log(`[PERF] findAllTransfersForExport ${elapsed()}ms (${result.docs.length} docs)`)
  return result.docs as RawTransferDocT[]
}
