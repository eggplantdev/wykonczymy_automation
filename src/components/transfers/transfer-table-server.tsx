import {
  findTransfersRaw,
  buildCancellationOriginalsMap,
  enrichCancellationOriginals,
} from '@/lib/queries/transfers'
import {
  scopeNarrowsByOriginalOnlyField,
  scopeAuditThroughOriginal,
  stripCancelledFilters,
  narrowToTransferIds,
} from '@/lib/queries/transfer-filters'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchFilteredByType } from '@/lib/queries/transfer-totals'
import { buildTransferRows } from '@/lib/queries/fetch-transfer-rows'
import {
  fetchAllDraftTransferIds,
  fetchDraftTransferIds,
} from '@/lib/queries/worker-expense-drafts'
import { TransferDataTable } from '@/components/transfers/transfer-data-table'
import { perfStart } from '@/lib/perf'
import type { TransferTableConfigT } from '@/components/transfers/transfer-table-config'

type TransferTableServerPropsT = {
  config: TransferTableConfigT
}

export async function TransferTableServer({ config: pageConfig }: TransferTableServerPropsT) {
  const step = perfStart()
  const allDraftTransferIds = pageConfig.onlyWorkerDrafts
    ? await fetchAllDraftTransferIds()
    : undefined
  const config = allDraftTransferIds
    ? {
        ...pageConfig,
        query: {
          ...pageConfig.query,
          where: narrowToTransferIds(pageConfig.query.where, allDraftTransferIds, {
            throughOriginal: pageConfig.cancelledTransactionAudit,
          }),
        },
      }
    : pageConfig
  const skipMedia = config.excludeColumns?.includes('invoice') ?? false
  // The audit list narrows through the original, the sum tile cannot — so where the raw where
  // narrows by an original-only field the tile would sum nothing, and is dropped instead.
  const showTotalAmount =
    config.showTotalAmount !== false &&
    !(config.cancelledTransactionAudit && scopeNarrowsByOriginalOnlyField(config.query.where))

  const listQuery = config.cancelledTransactionAudit
    ? { ...config.query, where: scopeAuditThroughOriginal(config.query.where) }
    : config.query

  const [rawTxResult, refData, typeDistribution] = await Promise.all([
    findTransfersRaw(listQuery),
    fetchReferenceData(),
    showTotalAmount
      ? fetchFilteredByType(stripCancelledFilters(config.query.where))
      : Promise.resolve([]),
  ])
  console.log(`[PERF] TransferTableServer findTransfersRaw + fetchReferenceData ${step()}ms`)

  let pageDocs = rawTxResult.docs
  if (config.cancelledTransactionAudit) {
    const originalsById = await buildCancellationOriginalsMap(pageDocs)
    if (originalsById.size > 0) {
      pageDocs = pageDocs.flatMap((doc) => {
        const orig = originalsById.get(doc.cancelledTransaction as number)
        return orig ? [orig, { ...doc, originalType: orig.type }] : [doc]
      })
    }
    console.log(`[PERF] TransferTableServer audit-mode pair fetch ${step()}ms`)
  } else {
    pageDocs = await enrichCancellationOriginals(pageDocs)
  }

  const [builtRows, draftTransferIds] = await Promise.all([
    buildTransferRows(pageDocs, refData, { skipMedia }),
    allDraftTransferIds ?? fetchDraftTransferIds(pageDocs.map((doc) => Number(doc.id))),
  ])
  const fromDrafts = new Set(draftTransferIds)
  const rows = builtRows.map((row) =>
    fromDrafts.has(row.id) ? { ...row, fromWorkerDraft: true } : row,
  )
  console.log(`[PERF] TransferTableServer buildTransferRows ${step()}ms`)

  const totalFilteredAmount = showTotalAmount
    ? typeDistribution.reduce((sum, t) => sum + t.total, 0)
    : undefined

  // buildTransferFilters only adds the `cancelled` exclusion when the list hides cancelled rows, so
  // its absence is exactly the case where the tile is narrower than the rows below it.
  const listsCancelled = !('cancelled' in config.query.where)

  return (
    <TransferDataTable
      data={rows}
      paginationMeta={rawTxResult.paginationMeta}
      config={{ ...config, totalFilteredAmount, listsCancelled }}
      referenceData={config.excludeColumns?.includes('actions') ? undefined : refData}
    />
  )
}
