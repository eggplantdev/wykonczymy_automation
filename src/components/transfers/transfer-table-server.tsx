import { findTransfersRaw } from '@/lib/queries/transfers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { buildTransferRows } from '@/lib/queries/fetch-transfer-rows'
import { TransferDataTable } from '@/components/transfers/transfer-data-table'
import { perfStart } from '@/lib/perf'
import type { FilterConfigT } from '@/types/filters'
import type { ExportContextT } from '@/types/export'
import type { TransferQueryT } from '@/types/transfer-query'

type TransferTableServerPropsT = {
  readonly query: TransferQueryT
  readonly baseUrl: string
  readonly excludeColumns?: string[]
  readonly filters?: FilterConfigT
  readonly context?: ExportContextT
  readonly contextId?: number
  readonly className?: string
}

export async function TransferTableServer({
  query,
  baseUrl,
  excludeColumns,
  filters,
  context,
  contextId,
  className,
}: TransferTableServerPropsT) {
  const step = perfStart()
  const skipMedia = excludeColumns?.includes('invoice') ?? false

  const [rawTxResult, refData] = await Promise.all([findTransfersRaw(query), fetchReferenceData()])
  console.log(`[PERF] TransferTableServer findTransfersRaw + fetchReferenceData ${step()}ms`)

  const rows = await buildTransferRows(rawTxResult.docs, refData, { skipMedia })
  console.log(`[PERF] TransferTableServer buildTransferRows ${step()}ms`)

  return (
    <TransferDataTable
      data={rows}
      paginationMeta={rawTxResult.paginationMeta}
      excludeColumns={excludeColumns}
      baseUrl={baseUrl}
      filters={filters}
      where={query.where}
      context={context}
      contextId={contextId}
      className={className}
    />
  )
}
