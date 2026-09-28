import { rowPlannedNetForView, viewPrice } from '@/lib/kosztorys/calc'
import { formatQty } from '@/lib/kosztorys/format'
import {
  DESCRIPTION_COLUMN,
  PLANNED_QTY_COLUMN,
  UNIT_COLUMN,
  moneyColumn,
  qtyColumn,
  stageNetColumns,
  stageQtyColumns,
  type OfferColumnT,
} from '@/lib/kosztorys/offer-print/columns'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  rowRemainingForExecutedQty,
  rowTotalQtyDone,
  rowValueForView,
} from '@/lib/kosztorys/settlement-rows'
import { STAGE_VALUE_NET_COLUMN_GROUP, STAGES_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'
import {
  workerColumnLabel,
  workerDocumentColumns,
  workerVisibleColumns,
} from '@/lib/kosztorys/worker-view/settings'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import { formatPLN } from '@/lib/utils/format-currency'

export type WorkerPrintColumnsArgsT = {
  plane: ToolPlaneT
  // His etapy only — the projection's `tree.stages`.
  stages: KosztorysStageT[]
  hiddenColumns: readonly string[]
  executedQtyByItem: Record<number, number>
}

/**
 * The worker's printed columns: `workerDocumentColumns`, the list his podgląd renders from, capped by
 * `workerVisibleColumns` — so the paper can neither carry a column the settings bar from the screen
 * nor print one in another place. Priced in grosze, unlike the offer: a stawka of 7,50 zł rounded to
 * „8 zł" is a different rate, not a tidier one.
 */
export function workerPrintColumns({
  plane,
  stages,
  hiddenColumns,
  executedQtyByItem,
}: WorkerPrintColumnsArgsT): OfferColumnT[] {
  const visible = workerVisibleColumns(plane, hiddenColumns)
  const rateKey = planePriceKey('price', plane)
  const byKey: Record<string, OfferColumnT[]> = {
    description: [DESCRIPTION_COLUMN],
    plannedQty: [PLANNED_QTY_COLUMN],
    unit: [UNIT_COLUMN],
    [rateKey]: [
      {
        ...moneyColumn(rateKey, 'Stawka j.m.', (row, view) => formatPLN(viewPrice(row, view))),
        cellClass: 'num price',
      },
    ],
    plannedNetForPlane: [
      moneyColumn('plannedNetForPlane', 'Wartość przedmiaru', (row, view) =>
        formatPLN(rowPlannedNetForView(row, view)),
      ),
    ],
    [STAGES_COLUMN_GROUP]: stageQtyColumns(stages),
    stageQtySum: [
      qtyColumn('stageQtySum', workerColumnLabel('stageQtySum') ?? '', (row, view, printStages) =>
        formatQty(rowTotalQtyDone(row, printStages, view)),
      ),
    ],
    [STAGE_VALUE_NET_COLUMN_GROUP]: stageNetColumns(stages, formatPLN),
    net: [
      moneyColumn('net', workerColumnLabel('net') ?? '', (row, view, printStages) =>
        formatPLN(rowValueForView(row, printStages, view)),
      ),
    ],
    remainingForPlane: [
      moneyColumn('remainingForPlane', 'Pozostało', (row, view) =>
        formatPLN(rowRemainingForExecutedQty(row, executedQtyByItem[row.id] ?? 0, view)),
      ),
    ],
  }
  return workerDocumentColumns(plane)
    .filter((key) => visible.has(key))
    .flatMap((key) => byKey[key] ?? [])
}
