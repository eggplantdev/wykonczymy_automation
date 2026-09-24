import {
  netForQtyForView,
  rowDiscountForView,
  rowPlannedNetForView,
  toGross,
} from '@/lib/kosztorys/calc'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { stageAxisForView } from '@/lib/kosztorys/settlement-aggregates'
import { rowRemainingForView, rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
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
 * The quantity columns („Przedmiar", „Pomiar (razem etapy)", each etap's ilość) are absent for that
 * reason: rows in one section carry different jednostki miary, so 40 m² + 12 mb + 3 szt. adds to 55
 * of nothing. Only the zł columns share a unit across rows and may be summed. Per row those columns
 * still total fine — one row is one jednostka — which is why the columns themselves stay.
 *
 * `net` is the executed value BEFORE any rabat globalny, matching what the „Razem" row has always
 * shown: the global rabat is a single subtraction the summary panel makes once, not a per-row figure
 * these columns could carry a share of.
 */
export function columnTotalsForRows(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  view: PriceViewT,
  vatRate: number,
): Map<string, number> {
  const totals = new Map<string, number>()
  const viewStages = stagesForView(stages, view)

  let net = 0
  let plannedNet = 0
  let discount = 0
  let remaining = 0
  for (const row of rows) {
    // One pomiar per row, priced twice: the value and the rabat taken on it must stand on the same
    // quantity, exactly as in sectionSubtotalsForView.
    const qtyDone = rowTotalQtyDone(row, viewStages, view)
    net += netForQtyForView(row, qtyDone, view)
    // Pinned to 'client' like the cells they total: the przedmiar is the whole offered scope in every view.
    plannedNet += rowPlannedNetForView(row, 'client')
    discount += rowDiscountForView(row, qtyDone, view)
    remaining += rowRemainingForView(row, stages, 'client')
  }

  totals.set('net', net)
  totals.set('gross', toGross(net, vatRate))
  totals.set('plannedNet', plannedNet)
  totals.set('plannedGross', toGross(plannedNet, vatRate))
  totals.set('remaining', remaining)
  totals.set('remainingGross', toGross(remaining, vatRate))
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
