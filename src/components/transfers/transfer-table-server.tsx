import {
  findTransfersRaw,
  buildCancellationOriginalsMap,
  enrichCancellationOriginals,
} from '@/lib/queries/transfers'
import {
  scopeNarrowsByOriginalOnlyField,
  scopeAuditThroughOriginal,
  stripCancelledFilters,
} from '@/lib/queries/transfer-filters'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchFilteredByType } from '@/lib/queries/transfer-totals'
import { buildTransferRows } from '@/lib/queries/fetch-transfer-rows'
import { fetchDraftTransferIds } from '@/lib/queries/worker-expense-drafts'
import { TransferDataTable } from '@/components/transfers/transfer-data-table'
import { rejectedDraftToRow } from '@/lib/transfers/rejected-draft-row'
import { perfStart } from '@/lib/perf'
import type { TransferTableConfigT } from '@/components/transfers/transfer-table-config'

type TransferTableServerPropsT = {
  config: TransferTableConfigT
}

export async function TransferTableServer({
  config: { rejectedDrafts = [], ...config },
}: TransferTableServerPropsT) {
  const step = perfStart()
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

  // Cancelled-transaction audit mode — pull originals referenced by each CANCELLATION row and splice them in directly above
  let pageDocs = rawTxResult.docs
  if (config.cancelledTransactionAudit) {
    const originalsById = await buildCancellationOriginalsMap(pageDocs)
    if (originalsById.size > 0) {
      pageDocs = pageDocs.flatMap((doc) => {
        const orig = originalsById.get(doc.cancelledTransaction as number)
        // Stamp originalType so the cancellation row's Typ label matches the non-audit view.
        return orig ? [orig, { ...doc, originalType: orig.type }] : [doc]
      })
    }
    console.log(`[PERF] TransferTableServer audit-mode pair fetch ${step()}ms`)
  } else {
    // Outside audit mode, a CANCELLATION row appears standalone (when showCancelled is on).
    // Borrow the original's relational fields so its columns aren't all em-dashes.
    pageDocs = await enrichCancellationOriginals(pageDocs)
  }

  const [builtRows, draftTransferIds] = await Promise.all([
    buildTransferRows(pageDocs, refData, { skipMedia }),
    fetchDraftTransferIds(pageDocs.map((doc) => Number(doc.id))),
  ])
  const fromDrafts = new Set(draftTransferIds)
  const rows = [
    ...(config.query.page === 1
      ? rejectedDrafts.map((draft) => rejectedDraftToRow(draft, refData))
      : []),
    ...builtRows.map((row) => (fromDrafts.has(row.id) ? { ...row, fromWorkerDraft: true } : row)),
  ]
  console.log(`[PERF] TransferTableServer buildTransferRows ${step()}ms`)

  // Server-derived sum overrides any caller-provided value. Single source of truth.
  const totalFilteredAmount = showTotalAmount
    ? typeDistribution.reduce((sum, t) => sum + t.total, 0)
    : undefined

  // buildTransferFilters only adds the `cancelled` exclusion when the list hides cancelled rows, so
  // its absence is exactly the case where the tile is narrower than the rows below it (EX-574).
  const listsCancelled = !('cancelled' in config.query.where)

  return (
    <TransferDataTable
      data={rows}
      paginationMeta={rawTxResult.paginationMeta}
      config={{ ...config, totalFilteredAmount, listsCancelled }}
      referenceData={refData}
    />
  )
}
