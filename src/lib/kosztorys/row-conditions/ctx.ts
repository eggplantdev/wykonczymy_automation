import { rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * Always the client plane, because that is the only plane the conditions read — the pomiar is the
 * whole scope, whichever crew executed it.
 */
export function qtyDoneByRow(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
): ReadonlyMap<number, number> {
  const byId = new Map<number, number>()
  for (const row of rows) byId.set(row.id, rowTotalQtyDone(row, stages, 'client'))
  return byId
}
