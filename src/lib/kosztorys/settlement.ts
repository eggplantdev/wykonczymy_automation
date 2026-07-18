import {
  netForQtyForView,
  rowDiscountForView,
  rowPlannedNetForView,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT, SectionSubtotalT } from '@/lib/kosztorys/types'

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
 * The etap axis: per-stage column total across all rows at the active view's price — the sheet's
 * `SUM(<stage col>)` per etap (filled r396/r397). The suma transzy: how much value each etap has
 * executed. Every stage in `stages` gets an entry (0 when no row touched it).
 *
 * Uses the same `stageValueForView` primitive the grid's per-stage cells show — each stage's value
 * is its qty share of the row's executed net — so Σ over the stages equals the row's executed value,
 * and Σ over all stages equals the executed total (the 'amount'-rabat reconciliation the sheet's
 * V–AE block exists for holds here by construction).
 */
export function stageTotalsForView(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: PriceViewT,
): Map<number, number> {
  const totals = new Map<number, number>(stages.map((st) => [st.id, 0]))
  for (const row of rows) {
    const totalQty = rowTotalQtyDone(row, stages)
    if (!(totalQty > 0)) continue
    // Price the row's executed net once, then split it by each stage's qty share — same figure
    // stageValueForView yields per cell, but without re-pricing the row on every stage.
    const rowNet = netForQtyForView(row, totalQty, view)
    for (const st of stages) {
      const qtyInStage = row[stageKey(st.id)] ?? 0
      if (!qtyInStage) continue
      totals.set(st.id, (totals.get(st.id) ?? 0) + rowNet * (qtyInStage / totalQty))
    }
  }
  return totals
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
  // completionRatio AND share are progress/structure figures, so both are weighted at the client price
  // regardless of `view`: per-item price overrides shift a section's executed VALUE against the others,
  // so the same physical progress and the same cost split must not read differently per view.
  // Accumulated apart from the money net above, which does follow the view.
  const clientBySection = new Map<number, { executed: number; offered: number }>()
  for (const row of rows) {
    let acc = bySection.get(row.sectionId)
    if (!acc) {
      acc = {
        sectionId: row.sectionId,
        sectionName: row.sectionName,
        net: 0,
        plannedNet: 0,
        discount: 0,
        share: 0,
        completionRatio: null,
        itemCount: 0,
      }
      bySection.set(row.sectionId, acc)
      clientBySection.set(row.sectionId, { executed: 0, offered: 0 })
    }
    acc.net += rowValueForView(row, stages, view)
    acc.plannedNet += rowPlannedNetForView(row, view)
    // Rabat taken on the executed qty (the same qty `net` prices) — 0 under a global discount.
    acc.discount += rowDiscountForView(row, rowTotalQtyDone(row, stages), view)
    acc.itemCount += 1
    const client = clientBySection.get(row.sectionId)!
    client.executed += rowValueForView(row, stages, 'client')
    client.offered += rowPlannedNetForView(row, 'client')
  }
  const result = [...bySection.values()]
  for (const s of result) {
    const client = clientBySection.get(s.sectionId)!
    s.completionRatio = client.offered > 0 ? client.executed / client.offered : null
  }
  const grandClientNet = [...clientBySection.values()].reduce((sum, c) => sum + c.executed, 0)
  if (grandClientNet > 0)
    for (const s of result) s.share = clientBySection.get(s.sectionId)!.executed / grandClientNet
  return result
}
