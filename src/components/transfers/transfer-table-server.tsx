import type { Where } from 'payload'
import { findTransfersRaw } from '@/lib/queries/transfers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { buildTransferRows } from '@/lib/queries/fetch-transfer-rows'
import { TransferDataTable } from '@/components/transfers/transfer-data-table'
import { perfStart } from '@/lib/perf'
import type { FilterConfigT } from '@/types/filters'
import type { ExportContextT } from '@/types/export'

type TransferTableServerPropsT = {
  readonly where: Where
  readonly page: number
  readonly limit: number
  readonly baseUrl: string
  readonly excludeColumns?: string[]
  readonly filters?: FilterConfigT
  readonly context?: ExportContextT
  readonly contextId?: number
  readonly className?: string
}

export async function TransferTableServer({
  where,
  page,
  limit,
  baseUrl,
  excludeColumns,
  filters,
  context,
  contextId,
  className,
}: TransferTableServerPropsT) {
  const step = perfStart()
  const skipMedia = excludeColumns?.includes('invoice') ?? false

  const [rawTxResult, refData] = await Promise.all([
    findTransfersRaw({ where, page, limit }),
    fetchReferenceData(),
  ])
  console.log(`[PERF] TransferTableServer findTransfersRaw + fetchReferenceData ${step()}ms`)

  const rows = await buildTransferRows(rawTxResult.docs, refData, { skipMedia })
  console.log(`[PERF] TransferTableServer buildTransferRows ${step()}ms`)

  const serializedWhere = JSON.stringify(where)

  return (
    <TransferDataTable
      data={rows}
      paginationMeta={rawTxResult.paginationMeta}
      excludeColumns={excludeColumns}
      baseUrl={baseUrl}
      filters={filters}
      serializedWhere={serializedWhere}
      context={context}
      contextId={contextId}
      className={className}
    />
  )
}
