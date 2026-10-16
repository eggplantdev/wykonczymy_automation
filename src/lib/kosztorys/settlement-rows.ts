import {
  MONEY_TOLERANCE,
  netForQtyForView,
  resolvedCurrentPlannedQty,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { stageAppliesToView } from '@/lib/kosztorys/settlement-view'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * `view` is REQUIRED, not defaulted — a default would silently restore the plane-blind reading at
 * any call site that forgets it.
 */
export function rowTotalQtyDone(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number {
  return stages.reduce(
    (sum, st) => (stageAppliesToView(st, view) ? sum + (row[stageKey(st.id)] ?? 0) : sum),
    0,
  )
}

/**
 * The row's settlement value at the view's price — the sheet's T: what has actually been executed.
 */
export function rowValueForView(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number {
  return netForQtyForView(row, rowTotalQtyDone(row, stages, view), view)
}

/**
 * Its AF anchors on T — the executed value — and since O IS the stage sum, AF = T − Σ(V:AE) is
 * identically zero: a dead column.
 */
export function rowRemainingForExecutedQty(
  row: KosztorysV2RowT,
  scopeQty: number,
  executedQty: number,
  view: PriceViewT,
): number {
  return netForQtyForView(row, scopeQty, view) - netForQtyForView(row, executedQty, view)
}

/**
 * a row executed exactly to its przedmiar can land at −0.000…1 through float noise, and that is
 * neither an overrun to paint red nor one to drop from the sum.
 */
export function isRemainingOverrun(remaining: number): boolean {
  return remaining < -MONEY_TOLERANCE
}

/**
 * A row with no przedmiar is excluded — reddening a dash says „przekroczono" over a figure that
 * isn't there: the reader sees an alarm with no legible cause.
 */
export function hasStagesOverPlanned(row: KosztorysV2RowT, stages: KosztorysStageT[]): boolean {
  const plannedQty = resolvedCurrentPlannedQty(row)
  if (!(plannedQty > 0)) return false
  return rowTotalQtyDone(row, stages, 'client') > plannedQty
}

export const QTY_TOLERANCE = 0.005

export type MeasureDiscrepancyT = {
  sheetQty: number
  stageQty: number
  qtyDiff: number
  net: number
}

/**
 * the sheet's pomiar has no plane, so measuring one crew's share against it would report a rozjazd
 * on work the other crew finished.
 */
export function measureDiscrepancy(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
): MeasureDiscrepancyT | null {
  const sheetQty = row.sheetMeasuredQty
  if (sheetQty == null) return null

  const stageQty = rowTotalQtyDone(row, stages, 'client')
  const qtyDiff = sheetQty - stageQty
  if (Math.abs(qtyDiff) < QTY_TOLERANCE) return null

  // a kwotowy rabat is deducted once from the row, so pricing `qtyDiff` directly would subtract the
  // whole rabat from a partial quantity — and on a small difference invert its sign.
  const net = netForQtyForView(row, sheetQty, 'client') - netForQtyForView(row, stageQty, 'client')

  return { sheetQty, stageQty, qtyDiff, net }
}
