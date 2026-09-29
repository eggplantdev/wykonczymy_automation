import { netForQtyForView, type PriceViewT } from '@/lib/kosztorys/calc'
import { computedColumnValues } from '@/lib/kosztorys/column-values'
import { rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import { stagesForView } from '@/lib/kosztorys/settlement-view'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type {
  KosztorysStageT,
  KosztorysV2RowT,
  SectionSubtotalClientT,
  SectionSubtotalT,
} from '@/lib/kosztorys/types'

export type StageAxisT = {
  // Per-stage executed value at the view's price — the sheet's `SUM(<stage col>)` per etap.
  net: Map<number, number>
  // Per-stage executed quantity, the axis the value above is split by.
  qty: Map<number, number>
}

/**
 * The etap axis: per-stage column totals across all rows at the active view's price (the sheet's
 * filled r396/r397). The suma transzy: how much each etap has executed, in value and in quantity.
 * Every stage in `stages` gets an entry in both maps (0 when no row touched it).
 *
 * Uses the same `stageValueForView` primitive the grid's per-stage cells show — each stage's value
 * is its qty share of the row's executed net — so Σ over the stages equals the row's executed value,
 * and Σ over all stages equals the executed total (the 'amount'-rabat reconciliation the sheet's
 * V–AE block exists for holds here by construction).
 *
 * The two axes ship together because the value is DERIVED from the quantity: this loop already reads
 * every `qtyInStage` to compute the share, so summing it costs nothing, whereas a caller wanting the
 * qty axis on its own has to walk the rows once per stage (EX-612).
 */
export function stageAxisForView(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: PriceViewT,
): StageAxisT {
  // Seeded over ALL stages, iterated over the view's own: an out-of-view etap must still report 0
  // rather than go missing, but it must never take a share of a total built without it — give it one
  // and it draws > 1 of the row, so Σ per-etap overshoots „Razem" by a multiple.
  const net = new Map<number, number>(stages.map((st) => [st.id, 0]))
  const qty = new Map<number, number>(stages.map((st) => [st.id, 0]))
  const viewStages = stagesForView(stages, view)
  for (const row of rows) {
    const totalQty = rowTotalQtyDone(row, viewStages, view)
    // Price the row's executed net once, then split it by each stage's qty share — same figure
    // stageValueForView yields per cell, but without re-pricing the row on every stage. A row with
    // nothing executed has no value to split, but its quantities still belong on the qty axis.
    const rowNet = totalQty > 0 ? netForQtyForView(row, totalQty, view) : 0
    for (const st of viewStages) {
      const qtyInStage = row[stageKey(st.id)] ?? 0
      if (!qtyInStage) continue
      qty.set(st.id, (qty.get(st.id) ?? 0) + qtyInStage)
      if (totalQty > 0) net.set(st.id, (net.get(st.id) ?? 0) + rowNet * (qtyInStage / totalQty))
    }
  }
  return { net, qty }
}

/**
 * Subtotals per section for the active price view, over the full dataset (ignores filter/sort).
 * Order = first occurrence of each section in `rows` (treeToRows already yields section→displayOrder).
 *
 * Carries BOTH figures, the way the sheet's footer keeps S456 and T456 side by side: `plannedNet` is
 * what was offered, `net` what has been executed. Nothing has to choose between them, and the
 * progress counter divides one by the other.
 */
// Overloaded on the literal so a caller that pins 'client' gets the przedmiar figure typed as present
// and never writes a `?? 0` for a case it already excluded, while a caller passing a `view` variable
// is forced to handle the null. The guarantee is structural — it cannot be forgotten at a call site.
export function sectionSubtotalsForView(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: 'client',
): SectionSubtotalClientT[]
export function sectionSubtotalsForView(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: PriceViewT,
): SectionSubtotalT[]
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
  const valueOf = computedColumnValues({ stages, view })
  const net = valueOf('net')
  const discount = valueOf('discountAmount')
  // Read at the client price in every view already (column-values.ts), so it serves both.
  const plannedNet = valueOf('plannedNet')
  const clientNet =
    view === 'client' ? net : computedColumnValues({ stages, view: 'client' })('net')
  for (const row of rows) {
    let acc = bySection.get(row.sectionId)
    if (!acc) {
      acc = {
        sectionId: row.sectionId,
        sectionName: row.sectionName,
        sectionColor: row.sectionColor,
        net: 0,
        plannedNet: view === 'client' ? 0 : null,
        discount: 0,
        share: 0,
        completionRatio: null,
        itemCount: 0,
      }
      bySection.set(row.sectionId, acc)
      clientBySection.set(row.sectionId, { executed: 0, offered: 0 })
    }
    acc.net += net(row) ?? 0
    if (acc.plannedNet !== null) acc.plannedNet += plannedNet(row) ?? 0
    // 0 under a global discount.
    acc.discount += discount(row) ?? 0
    acc.itemCount += 1
    const client = clientBySection.get(row.sectionId)!
    client.executed += clientNet(row) ?? 0
    client.offered += plannedNet(row) ?? 0
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
