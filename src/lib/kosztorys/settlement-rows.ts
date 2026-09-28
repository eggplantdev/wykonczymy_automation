import { netForQtyForView, rowPlannedNetForView, type PriceViewT } from '@/lib/kosztorys/calc'
import { stageAppliesToView } from '@/lib/kosztorys/settlement-view'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * The "Pomiar z natury" itself — the sheet's O = SUM(D:M), not a stored field (EX-494).
 *
 * Scoped to the view's etapy: in a subcontractor view the pomiar is that crew's pomiar, so every
 * figure standing on it (row wartość, section subtotals, „Razem") counts one crew's work at one
 * crew's price. `view` is REQUIRED, not defaulted — a default would silently restore the plane-blind
 * reading at any call site that forgets it, which is the exact bug this parameter exists to kill.
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
 *
 * There is no choice of quantity to make here (EX-494): the pomiar IS the stage sum, so a branch
 * "pomiar or stages?" would be picking between a number and itself. This is the reason the
 * settlement layer lives here and not in calc.ts — the quantity comes from the stages, and calc.ts
 * is the pricing layer, structurally stage-blind. It owns the price beneath this; we own the
 * quantity above it.
 *
 * Straight from the primitive rather than Σ stageValueForView: the shares sum to 1, so the reduce
 * would buy the same figure at O(stages) and a rounding error.
 */
export function rowValueForView(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number {
  return netForQtyForView(row, rowTotalQtyDone(row, stages, view), view)
}

/**
 * How much of the OFFER is left: the przedmiar's value minus what the stages have executed.
 *
 * This is where we knowingly break parity with the sheet. Its AF anchors on T — the executed value —
 * and since O IS the stage sum, AF = T − Σ(V:AE) is identically zero: a dead column. Anchored on S
 * instead, the figure says something ("how much of the offer is left") and can go negative, which is
 * also information: more was executed than was offered.
 *
 * A row with no przedmiar is an offer of ZERO, not an absent answer, so it reads −wykonane rather
 * than being withheld. Withholding it made the total claim work was still owed while the executed
 * value that cancels it sat outside the sum: inv. 31 read +64 311 zł „left" on a kosztorys already
 * 23 602 zł past its own offer. `?? 0` because a cleared cell writes null.
 */
export function rowRemainingForView(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number {
  return netForQtyForView(row, row.plannedQty ?? 0, view) - rowValueForView(row, stages, view)
}

/**
 * The worker view's „Pozostało" (EX-875 design #9): the same przedmiar-anchored reading, but the
 * executed quantity is handed in rather than summed off `stages`. The worker's grid carries his etapy
 * only, and a pozycja another crew finished is not work still owed to anyone — so the quantity comes
 * from every etap of the investment, while the price stays his stawka.
 */
export function rowRemainingForExecutedQty(
  row: KosztorysV2RowT,
  executedQty: number,
  view: PriceViewT,
): number {
  return netForQtyForView(row, row.plannedQty ?? 0, view) - netForQtyForView(row, executedQty, view)
}

/**
 * Was more executed than was offered? Drives the row's red highlight.
 *
 * Deliberately NOT "przedmiar ≠ Σ etapów": a half-finished row is normal work in progress, and
 * flagging it would paint the whole grid red on a healthy kosztorys.
 *
 * A row with no przedmiar is excluded — the same `> 0` guard `rowDoneFraction` uses, and for the
 * same reason. Its cell has no percentage to render, so it shows „—", and reddening a dash says
 * „przekroczono" over a figure that isn't there: the reader sees an alarm with no legible cause.
 * Work booked against no offer is a real problem, but it is a different one, and it belongs to the
 * „Problemy" diagnostics, which can name it.
 *
 * Hard-anchored to the client pomiar, not the active view: the przedmiar has no plane (it is typed
 * once per row for the whole offered scope), so comparing one crew's share against it would flag
 * „under-plan" on work the other crew finished.
 */
export function hasStagesOverPlanned(row: KosztorysV2RowT, stages: KosztorysStageT[]): boolean {
  if (!(row.plannedQty > 0)) return false
  return rowTotalQtyDone(row, stages, 'client') > row.plannedQty
}

// Quantities are typed in m², mb and kpl, often to two decimals, so an exact `!==` would light up
// half the kosztorys on float noise alone (0.1 + 0.2 ≠ 0.3). Half a hundredth of a unit is below
// what anyone types and worth pennies at any real price — the money reconciliation's grosz-exact
// tolerance is a different axis and does not transfer here.
export const QTY_TOLERANCE = 0.005

export type MeasureDiscrepancyT = {
  sheetQty: number
  stageQty: number
  qtyDiff: number
  // What the difference is worth at the client price — the figure that says whether a rozjazd is
  // worth chasing. Always the client plane: the sheet's own „Pomiar z natury" covers the whole
  // offered scope, so the money beside it has to be the client's money too.
  net: number
}

/**
 * What the imported sheet claimed as „Pomiar z natury" against what the etapy actually say.
 *
 * `null` — including for a difference under the tolerance — means „nothing to answer for": either
 * the sheet made no claim (never imported, or a formula rather than a hand-typed measurement), or
 * the two agree. Anything else is work the sheet says was measured and the etapy have yet to
 * account for, and it shrinks by itself as quantities are typed into the etapy.
 *
 * Hard-anchored to the client plane like `hasStagesOverPlanned`, for the same reason: the sheet's
 * pomiar has no plane, so measuring one crew's share against it would report a rozjazd on work the
 * other crew finished.
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

  // The gap between two whole-row values, never the difference priced as a row of its own: a
  // kwotowy rabat is deducted once from the row, so pricing `qtyDiff` directly would subtract the
  // whole rabat from a partial quantity — and on a small difference invert its sign. Subtracting
  // two row values cancels the rabat exactly, and the sign falls out of the subtraction.
  const net = netForQtyForView(row, sheetQty, 'client') - netForQtyForView(row, stageQty, 'client')

  return { sheetQty, stageQty, qtyDiff, net }
}
