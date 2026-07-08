import type { Where } from 'payload'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import { findAllTransfersForExport } from '@/lib/queries/export-transfers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchMediaByIds } from '@/lib/queries/media'
import {
  mapTransferRow,
  extractInvoiceIds,
  buildTransferLookups,
  type TransferDocT,
} from '@/lib/queries/transfer-mapping'
import type { TransferRowT } from '@/types/transfers'
import type { RawTransferDocT } from '@/lib/queries/transfers'

type BuildRowsOptsT = {
  skipMedia?: boolean
}

/** Maps raw transfer docs + reference data into TransferRowT[]. */
export async function buildTransferRows(
  docs: RawTransferDocT[],
  refData: ReferenceDataBaseT,
  { skipMedia = false }: BuildRowsOptsT = {},
): Promise<TransferRowT[]> {
  const mediaMap = skipMedia ? new Map() : await fetchMediaByIds(extractInvoiceIds(docs))
  const lookups = buildTransferLookups(refData, mediaMap)
  // Query rows are loosely typed (Record<string, any>); the mapper declares the
  // depth:0 shape it needs, so narrow at this boundary.
  return docs.map((doc) => mapTransferRow(doc as TransferDocT, lookups))
}

/** Fetches all matching transfers (unpaginated) and maps them to rows. */
export async function fetchAllTransferRows(where: Where): Promise<TransferRowT[]> {
  const [docs, refData] = await Promise.all([
    findAllTransfersForExport(where),
    fetchReferenceData(),
  ])
  return buildTransferRows(docs, refData)
}
