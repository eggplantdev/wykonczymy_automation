import { netForQtyForView, type PriceViewT } from '@/lib/kosztorys/calc'
import { computedColumnValues } from '@/lib/kosztorys/columns/column-values'
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
  net: Map<number, number>
  qty: Map<number, number>
}

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
  const clientBySection = new Map<number, { executed: number; agreed: number }>()
  const valueOf = computedColumnValues({ stages, view })
  const net = valueOf('net')
  const discount = valueOf('discountAmount')
  const plannedNet = valueOf('plannedNet')
  const currentPlannedNet = valueOf('currentPlannedNet')
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
        currentPlannedNet: view === 'client' ? 0 : null,
        discount: 0,
        share: 0,
        completionRatio: null,
        itemCount: 0,
      }
      bySection.set(row.sectionId, acc)
      clientBySection.set(row.sectionId, { executed: 0, agreed: 0 })
    }
    acc.net += net(row) ?? 0
    if (acc.plannedNet !== null) acc.plannedNet += plannedNet(row) ?? 0
    if (acc.currentPlannedNet !== null) acc.currentPlannedNet += currentPlannedNet(row) ?? 0
    acc.discount += discount(row) ?? 0
    acc.itemCount += 1
    const client = clientBySection.get(row.sectionId)!
    client.executed += clientNet(row) ?? 0
    client.agreed += currentPlannedNet(row) ?? 0
  }
  const result = [...bySection.values()]
  for (const s of result) {
    const client = clientBySection.get(s.sectionId)!
    s.completionRatio = client.agreed > 0 ? client.executed / client.agreed : null
  }
  const grandClientNet = [...clientBySection.values()].reduce((sum, c) => sum + c.executed, 0)
  if (grandClientNet > 0)
    for (const s of result) s.share = clientBySection.get(s.sectionId)!.executed / grandClientNet
  return result
}
