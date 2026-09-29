import {
  netForQtyForView,
  rowDiscountForView,
  rowDoneFraction,
  rowPlannedNetForView,
  stageValueForView,
  toGross,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { memoisedByRow } from '@/lib/kosztorys/memoised-by-row'
import { rowRemainingForExecutedQty, rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import { stageAppliesToView } from '@/lib/kosztorys/settlement-view'
import {
  stageIdFromValueGrossKey,
  stageIdFromValueNetKey,
  stageKey,
} from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

type ColumnValueCtxT = {
  stages: KosztorysStageT[]
  view: PriceViewT
  // The worker surface's all-etapy quantity — only with it does `remainingForPlane` resolve.
  executedQtyByItem?: Record<number, number>
}

// `null` = the figure has no answer for this row (no przedmiar to divide by, an etap the view does not
// price) — no surface shows a number for it and the sort sinks it.
export type ColumnValueT = (row: KosztorysV2RowT) => number | null
export type ColumnValuesT = (field: string) => ColumnValueT

/**
 * The per-row value of every COMPUTED kosztorys column, composed once. The grid cell, the sort key,
 * the column totals and the prints all read it, so none of them can show one figure while another
 * orders or sums a different one.
 *
 * Build one per pass (one grid assembly, one sort, one totals call): it memoises Σ etapów per row,
 * which 2×|etapy| stage-value cells would otherwise each recompute, making a row O(|etapy|²).
 *
 * Returns `undefined` for an id it does not compute — a row field or an editable column — so the
 * caller falls back to its own reading.
 */
export function columnValueResolver({
  stages,
  view,
  executedQtyByItem,
}: ColumnValueCtxT): (field: string) => ColumnValueT | undefined {
  // `rowTotalQtyDone` narrows to the view's etapy itself, so this is Σ etapów of the whole VIEW —
  // never of a column-narrowed list, which would reprice the stage columns left standing.
  const totalQtyDone = memoisedByRow((row) => rowTotalQtyDone(row, stages, view))
  const grossOf =
    (netOf: ColumnValueT): ColumnValueT =>
    (row) => {
      const value = netOf(row)
      return value === null ? null : toGross(value, row.vatRate)
    }

  // The przedmiar figures read at the client price over the whole offered scope in EVERY view (owner,
  // 2026-09-23): „how much of the offer" is a question about the offer, whichever crew is looking.
  const plannedNet = (row: KosztorysV2RowT) => rowPlannedNetForView(row, 'client')
  const clientQtyDone = memoisedByRow((row) => rowTotalQtyDone(row, stages, 'client'))
  const remaining = (row: KosztorysV2RowT) =>
    rowRemainingForExecutedQty(row, clientQtyDone(row), 'client')
  const donePercent = (row: KosztorysV2RowT) => rowDoneFraction(row, clientQtyDone(row))
  const net = (row: KosztorysV2RowT) => netForQtyForView(row, totalQtyDone(row), view)
  const discount = (row: KosztorysV2RowT) => rowDiscountForView(row, totalQtyDone(row), view)

  const byField = new Map<string, ColumnValueT>([
    ['stageQtySum', totalQtyDone],
    ['priceGross', grossOf((row) => viewPrice(row, view))],
    ['discountAmount', discount],
    ['discountAmountGross', grossOf(discount)],
    ['plannedNet', plannedNet],
    ['plannedGross', grossOf(plannedNet)],
    ['plannedNetForPlane', (row) => rowPlannedNetForView(row, view)],
    ['net', net],
    ['gross', grossOf(net)],
    ['donePercent', donePercent],
    ['remaining', remaining],
    ['remainingGross', grossOf(remaining)],
  ])
  if (executedQtyByItem) {
    byField.set('remainingForPlane', (row) =>
      rowRemainingForExecutedQty(row, executedQtyByItem[row.id] ?? 0, view),
    )
  }

  const stageValueNet = (stageId: number): ColumnValueT => {
    const stage = stages.find((st) => st.id === stageId)
    if (!stage || !stageAppliesToView(stage, view)) return () => null
    const qtyKey = stageKey(stageId)
    return (row) => stageValueForView(row, row[qtyKey] ?? 0, totalQtyDone(row), view)
  }

  return (field) => {
    const fixed = byField.get(field)
    if (fixed) return fixed
    const netStageId = stageIdFromValueNetKey(field)
    if (netStageId !== null) return stageValueNet(netStageId)
    const grossStageId = stageIdFromValueGrossKey(field)
    if (grossStageId !== null) return grossOf(stageValueNet(grossStageId))
    return undefined
  }
}

/**
 * For a surface that renders a column as computed and so has no fallback of its own: an id the
 * resolver cannot compute fails the build of the grid or the document rather than rendering a blank.
 */
export function computedColumnValues(ctx: ColumnValueCtxT): ColumnValuesT {
  const resolve = columnValueResolver(ctx)
  return (field) => {
    const value = resolve(field)
    if (!value) throw new Error(`column-values.ts computes no value for the column „${field}"`)
    return value
  }
}
