import { toGross } from '@/lib/kosztorys/calc'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { computedColumnValues } from '@/lib/kosztorys/columns/column-values'
import { stageAxisForView } from '@/lib/kosztorys/settlement-aggregates'
import { isRemainingOverrun } from '@/lib/kosztorys/settlement-rows'
import { stagesForView } from '@/lib/kosztorys/settlement-view'
import { stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * The quantity columns (both przedmiary, „Pomiar z natury (etapy razem)", each etap's ilość) are absent:
 * rows in one section carry different jednostki miary, so 40 m² + 12 mb + 3 szt. adds to 55
 * of nothing.
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

  const valuesOf = computedColumnValues({ stages, view, executedQtyByItem })
  const sumOf = (id: string, include: (value: number) => boolean = () => true) => {
    const valueOf = valuesOf(id)
    let total = 0
    for (const row of rows) {
      const value = valueOf(row) ?? 0
      if (include(value)) total += value
    }
    return total
  }
  const notOverrun = (value: number) => !isRemainingOverrun(value)
  const net = sumOf('net')
  const plannedNet = sumOf('plannedNet')
  const currentPlannedNet = sumOf('currentPlannedNet')
  const discount = sumOf('discountAmount')
  const remaining = sumOf('remaining', notOverrun)

  totals.set('net', net)
  totals.set('gross', toGross(net, vatRate))
  totals.set('plannedNet', plannedNet)
  totals.set('plannedGross', toGross(plannedNet, vatRate))
  totals.set('currentPlannedNet', currentPlannedNet)
  totals.set('currentPlannedGross', toGross(currentPlannedNet, vatRate))
  if (view !== 'client') totals.set('plannedNetForPlane', sumOf('plannedNetForPlane'))
  totals.set('aiPlannedNet', sumOf('aiPlannedNet'))
  totals.set('remaining', remaining)
  totals.set('remainingGross', toGross(remaining, vatRate))
  if (executedQtyByItem) totals.set('remainingForPlane', sumOf('remainingForPlane', notOverrun))
  totals.set('discountAmount', discount)
  totals.set('discountAmountGross', toGross(discount, vatRate))
  const stageAxis = stageAxisForView(rows, stages, view)
  for (const stage of viewStages) {
    const stageValueNet = stageAxis.net.get(stage.id) ?? 0
    totals.set(stageValueNetKey(stage.id), stageValueNet)
    totals.set(stageValueGrossKey(stage.id), toGross(stageValueNet, vatRate))
  }
  return totals
}
