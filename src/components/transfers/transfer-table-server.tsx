import {
  findTransfersRaw,
  findTransfersByIds,
  stripCancelledFilters,
} from '@/lib/queries/transfers'
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

  // Cancelled-transaction audit mode — pull originals referenced by each CANCELLATION row and splice them in directly above
  let pageDocs = rawTxResult.docs
  if (config.cancelledTransactionAudit) {
    const originalIds = pageDocs
      .map((d) => d.cancelledTransaction)
      .filter((v): v is number => typeof v === 'number')
    if (originalIds.length > 0) {
      const originals = await findTransfersByIds(originalIds)
      const originalsById = new Map(originals.map((o) => [o.id as number, o]))
      pageDocs = pageDocs.flatMap((doc) => {
        const orig = originalsById.get(doc.cancelledTransaction as number)
        return orig ? [orig, doc] : [doc]
      })
    }
    console.log(`[PERF] TransferTableServer audit-mode pair fetch ${step()}ms`)
  }

  const rows = await buildTransferRows(pageDocs, refData, { skipMedia })
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
