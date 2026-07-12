import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'
import { perfStart } from '@/lib/perf'
import { assertCompletePage } from '@/lib/queries/assert-complete-page'
import type { RawTransferDocT } from '@/lib/queries/transfers'

/** Fetches ALL matching transfers (capped, must be complete) for export. Not cached. */
export async function findAllTransfersForExport(where: Where): Promise<RawTransferDocT[]> {
  const elapsed = perfStart()
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'transactions',
    where,
    sort: '-date',
    limit: 50000,
    depth: 0,
    overrideAccess: true,
  })

  console.log(`[PERF] findAllTransfersForExport ${elapsed()}ms (${result.docs.length} docs)`)
  return assertCompletePage(result, 'findAllTransfersForExport') as RawTransferDocT[]
}
