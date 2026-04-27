import { findTransfersRaw, stripCancelledFilters } from '@/lib/queries/transfers'
import { fetchReferenceData, fetchFilteredByType } from '@/lib/queries/reference-data'
import { buildTransferRows } from '@/lib/queries/fetch-transfer-rows'
import { TransferDataTable } from '@/components/transfers/transfer-data-table'
import { perfStart } from '@/lib/perf'
import type { TransferTableConfigT } from '@/types/export'

type TransferTableServerPropsT = {
  config: TransferTableConfigT
}

export async function TransferTableServer({ config }: TransferTableServerPropsT) {
  const step = perfStart()
  const skipMedia = config.excludeColumns?.includes('invoice') ?? false
  const showTotalAmount = config.showTotalAmount !== false

  const [rawTxResult, refData, typeDistribution] = await Promise.all([
    findTransfersRaw(config.query),
    fetchReferenceData(),
    showTotalAmount
      ? fetchFilteredByType(stripCancelledFilters(config.query.where))
      : Promise.resolve([]),
  ])
  console.log(`[PERF] TransferTableServer findTransfersRaw + fetchReferenceData ${step()}ms`)

  const rows = await buildTransferRows(rawTxResult.docs, refData, { skipMedia })
  console.log(`[PERF] TransferTableServer buildTransferRows ${step()}ms`)

  // Server-derived sum overrides any caller-provided value. Single source of truth.
  const totalFilteredAmount = showTotalAmount
    ? typeDistribution.reduce((sum, t) => sum + t.total, 0)
    : undefined

  return (
    <TransferDataTable
      data={rows}
      paginationMeta={rawTxResult.paginationMeta}
      config={{ ...config, totalFilteredAmount }}
      referenceData={refData}
    />
  )
}
