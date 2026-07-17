import { netForQtyForView, rowPlannedNetForView, type PriceViewT } from '@/lib/kosztorys/calc'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT, SectionSubtotalT } from '@/types/kosztorys'

/** The "Pomiar z natury" itself — the sheet's O = SUM(D:M), not a stored field (EX-494). */
export function rowTotalQtyDone(row: KosztorysV2RowT, stages: KosztorysStageT[]): number {
  return stages.reduce((sum, st) => sum + (row[stageKey(st.id)] ?? 0), 0)
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
  return netForQtyForView(row, rowTotalQtyDone(row, stages), view)
}

/**
 * How much of the OFFER is left: the przedmiar's value minus what the stages have executed.
 *
 * This is where we knowingly break parity with the sheet. Its AF anchors on T — the executed value —
 * and since O IS the stage sum, AF = T − Σ(V:AE) is identically zero: a dead column. Anchored on S
 * instead, the figure says something ("how much of the offer is left") and can go negative, which is
 * also information: more was executed than was offered.
 *
 * `null`, not 0, when there is no przedmiar — 0 would claim the row is settled. The guard is `> 0`
 * rather than `=== 0` because a cleared cell writes null, which strict equality walks past.
 */
export function rowRemainingForView(
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number | null {
  if (!(row.plannedQty > 0)) return null
  return rowPlannedNetForView(row, view) - rowValueForView(row, stages, view)
}

/**
 * Was more executed than was offered? Drives the row's red highlight.
 *
 * Deliberately NOT "przedmiar ≠ Σ etapów": a half-finished row is normal work in progress, and
 * flagging it would paint the whole grid red on a healthy kosztorys. Work recorded against no
 * przedmiar at all is not a separate branch — it is the przedmiar-is-0 case, which every stage
 * overshoots.
 */
export function hasStagesOverPlanned(row: KosztorysV2RowT, stages: KosztorysStageT[]): boolean {
  return rowTotalQtyDone(row, stages) > (row.plannedQty ?? 0)
}

/**
 * Subtotals per section for the active price view, over the full dataset (ignores filter/sort).
 * Order = first occurrence of each section in `rows` (treeToRows already yields section→displayOrder).
 *
 * Carries BOTH figures, the way the sheet's footer keeps S456 and T456 side by side: `plannedNet` is
 * what was offered, `net` what has been executed. Nothing has to choose between them, and the
 * progress counter divides one by the other.
 */
export function sectionSubtotalsForView(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: PriceViewT,
): SectionSubtotalT[] {
  const bySection = new Map<number, SectionSubtotalT>()
  for (const row of rows) {
    let acc = bySection.get(row.sectionId)
    if (!acc) {
      acc = {
        sectionId: row.sectionId,
        sectionName: row.sectionName,
        net: 0,
        plannedNet: 0,
        share: 0,
        itemCount: 0,
      }
      bySection.set(row.sectionId, acc)
    }
    acc.net += rowValueForView(row, stages, view)
    acc.plannedNet += rowPlannedNetForView(row, view)
    acc.itemCount += 1
  }
  const result = [...bySection.values()]
  const grandNet = result.reduce((sum, s) => sum + s.net, 0)
  if (grandNet > 0) for (const s of result) s.share = s.net / grandNet
  return result
}
