import { rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * The pomiar of every pozycja, computed once for the whole dataset — what `RowConditionCtxT`'s
 * `qtyDoneByRowId` carries.
 *
 * Built by the host, beside `divergentPriceRowIds` and for the same reason: it is one pass over the
 * rows, and a `matches` that computes it pays for it once per pozycja per condition. Always the
 * client plane, because that is the only plane the conditions read — the pomiar is the whole scope,
 * whichever crew executed it (EX-494).
 */
export function qtyDoneByRow(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
): ReadonlyMap<number, number> {
  const byId = new Map<number, number>()
  for (const row of rows) byId.set(row.id, rowTotalQtyDone(row, stages, 'client'))
  return byId
}
