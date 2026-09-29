import { toGross } from '@/lib/kosztorys/calc'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { columnValueResolver } from '@/lib/kosztorys/column-values'
import { stageAxisForView } from '@/lib/kosztorys/settlement-aggregates'
import { isRemainingOverrun } from '@/lib/kosztorys/settlement-rows'
import { stagesForView } from '@/lib/kosztorys/settlement-view'
import { stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * Every column's total over a set of rows, keyed by the grid's own column ids — the shape both the
 * „Razem" row and each section's footer render from.
 *
 * One function for both, because they are the same figure at two scopes: the footer is this over one
 * section's rows, „Razem" is this over all of them. Σ of the footers therefore equals „Razem" by
 * construction rather than by two implementations happening to agree.
 *
 * A column absent from the map renders blank. That is the honest outcome for a column whose total is
 * not a sum of its own cells (a share, a ratio) — never a 0, which would claim a reading.
 *
 * The „Pozostało" columns are the one exception that is still rendered: their total sums only rows
 * NOT past the przedmiar, because it answers „ile oferty zostało do zrobienia" and an overrun row
 * does not make the rest of the offer any less owed (EX-885). The skip is per row, so Σ footers =
 * „Razem" still holds.
 *
 * The quantity columns („Przedmiar", „Pomiar (razem etapy)", each etap's ilość) are absent for that
 * reason: rows in one section carry different jednostki miary, so 40 m² + 12 mb + 3 szt. adds to 55
 * of nothing. Only the zł columns share a unit across rows and may be summed. Per row those columns
 * still total fine — one row is one jednostka — which is why the columns themselves stay.
 *
 * `net` is the executed value BEFORE any rabat globalny, matching what the „Razem" row has always
 * shown: the global rabat is a single subtraction the summary panel makes once, not a per-row figure
 * these columns could carry a share of.
 *
 * `executedQtyByItem` is the worker surface's all-etapy quantity; only with it is `remainingForPlane`
 * totalled, matching the column, which is assembled only there.
 */
export function columnTotalsForRows(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: PriceViewT,
  vatRate: number,
  executedQtyByItem?: Record<number, number>,
): Map<string, number> {
  const totals = new Map<string, number>()
  const viewStages = stagesForView(stages, view)

  // Σ of the very values the cells render (column-values.ts), so a total cannot add up a figure no
  // cell shows.
  const resolveValue = columnValueResolver({ stages, view, executedQtyByItem })
  const sumOf = (id: string, include: (value: number) => boolean = () => true) => {
    const valueOf = resolveValue(id)
    let total = 0
    for (const row of rows) {
      const value = valueOf?.(row) ?? 0
      if (include(value)) total += value
    }
    return total
  }
  const notOverrun = (value: number) => !isRemainingOverrun(value)
  const net = sumOf('net')
  const plannedNet = sumOf('plannedNet')
  const discount = sumOf('discountAmount')
  const remaining = sumOf('remaining', notOverrun)

  totals.set('net', net)
  totals.set('gross', toGross(net, vatRate))
  totals.set('plannedNet', plannedNet)
  totals.set('plannedGross', toGross(plannedNet, vatRate))
  if (view !== 'client') totals.set('plannedNetForPlane', sumOf('plannedNetForPlane'))
  totals.set('remaining', remaining)
  totals.set('remainingGross', toGross(remaining, vatRate))
  if (executedQtyByItem) totals.set('remainingForPlane', sumOf('remainingForPlane', notOverrun))
  totals.set('discountAmount', discount)
  totals.set('discountAmountGross', toGross(discount, vatRate))
  // Iterated over the view's own stages only: an out-of-view etap has no column here to total, and
  // stageAxisForView deliberately gives it no share of the value either.
  const stageAxis = stageAxisForView(rows, stages, view)
  for (const stage of viewStages) {
    const stageValueNet = stageAxis.net.get(stage.id) ?? 0
    totals.set(stageValueNetKey(stage.id), stageValueNet)
    totals.set(stageValueGrossKey(stage.id), toGross(stageValueNet, vatRate))
  }
  return totals
}
