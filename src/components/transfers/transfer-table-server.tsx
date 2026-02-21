import type { Where } from 'payload'
import { findTransfersRaw } from '@/lib/queries/transfers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchMediaByIds } from '@/lib/queries/media'
import { mapTransferRow, extractInvoiceIds, buildTransferLookups } from '@/lib/tables/transfers'
import { TransferDataTable } from '@/components/transfers/transfer-data-table'
import type { FilterConfigT } from '@/types/filters'

type TransferTableServerPropsT = {
  readonly where: Where
  readonly page: number
  readonly limit: number
  readonly baseUrl: string
  readonly excludeColumns?: string[]
  readonly filters?: FilterConfigT
  readonly className?: string
}

export async function TransferTableServer({
  where,
  page,
  limit,
  baseUrl,
  excludeColumns,
  filters,
  className,
}: TransferTableServerPropsT) {
  const needsMedia = !excludeColumns?.includes('invoice')

  const [rawTxResult, refData] = await Promise.all([
    findTransfersRaw({ where, page, limit }),
    fetchReferenceData(),
  ])

  const mediaMap = needsMedia
    ? await fetchMediaByIds(extractInvoiceIds(rawTxResult.docs))
    : new Map()
  const lookups = buildTransferLookups(refData, mediaMap)
  const rows = rawTxResult.docs.map((doc) => mapTransferRow(doc, lookups))

  return (
    <TransferDataTable
      data={rows}
      paginationMeta={rawTxResult.paginationMeta}
      excludeColumns={excludeColumns}
      baseUrl={baseUrl}
      filters={filters}
      className={className}
    />
  )
}
