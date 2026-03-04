import { findTransfersRaw } from '@/lib/queries/transfers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { buildTransferRows } from '@/lib/queries/fetch-transfer-rows'
import { TransferDataTable } from '@/components/transfers/transfer-data-table'
import { perfStart } from '@/lib/perf'
import type { TransferTableConfigT } from '@/types/export'

type TransferTableServerPropsT = {
  readonly config: TransferTableConfigT
  readonly className?: string
}

export async function TransferTableServer({ config, className }: TransferTableServerPropsT) {
  const step = perfStart()
  const skipMedia = config.excludeColumns?.includes('invoice') ?? false

  const [rawTxResult, refData] = await Promise.all([
    findTransfersRaw(config.query),
    fetchReferenceData(),
  ])
  console.log(`[PERF] TransferTableServer findTransfersRaw + fetchReferenceData ${step()}ms`)

  const rows = await buildTransferRows(rawTxResult.docs, refData, { skipMedia })
  console.log(`[PERF] TransferTableServer buildTransferRows ${step()}ms`)

  return (
    <TransferDataTable
      data={rows}
      paginationMeta={rawTxResult.paginationMeta}
      config={config}
      className={className}
    />
  )
}
