import { viewPrice } from '@/lib/kosztorys/calc'
import { computedColumnValues } from '@/lib/kosztorys/column-values'
import { formatQty } from '@/lib/kosztorys/format'
import {
  DESCRIPTION_COLUMN,
  PLANNED_QTY_COLUMN,
  UNIT_COLUMN,
  formattedValue,
  moneyColumn,
  qtyColumn,
  stageNetColumns,
  stageQtyColumns,
  type PrintColumnT,
} from '@/lib/kosztorys/print/columns'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { STAGE_VALUE_NET_COLUMN_GROUP, STAGES_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'
import {
  workerColumnLabel,
  workerDocumentColumns,
  workerVisibleColumns,
} from '@/lib/kosztorys/worker-view/settings'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import { formatPLN } from '@/lib/utils/format-currency'
import type { ColumnRanksT } from '@/lib/table/column-order'

export type WorkerPrintColumnsArgsT = {
  plane: ToolPlaneT
  // His etapy only — the projection's `tree.stages`.
  stages: KosztorysStageT[]
  hiddenColumns: readonly string[]
  columnRanks: ColumnRanksT
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
  columnRanks,
  executedQtyByItem,
}: WorkerPrintColumnsArgsT): PrintColumnT[] {
  const visible = workerVisibleColumns(plane, hiddenColumns)
  const rateKey = planePriceKey('price', plane)
  const valueOf = computedColumnValues({ stages, view: plane, executedQtyByItem })
  const money = (key: string) => formattedValue(valueOf(key), formatPLN)
  const byKey: Record<string, PrintColumnT[]> = {
    description: [DESCRIPTION_COLUMN],
    plannedQty: [PLANNED_QTY_COLUMN],
    unit: [UNIT_COLUMN],
    [rateKey]: [
      {
        ...moneyColumn(rateKey, 'Stawka j.m.', (row) => formatPLN(viewPrice(row, plane))),
        cellClass: 'num price',
      },
    ],
    plannedNetForPlane: [
      moneyColumn('plannedNetForPlane', 'Wartość przedmiaru', money('plannedNetForPlane')),
    ],
    [STAGES_COLUMN_GROUP]: stageQtyColumns(stages),
    stageQtySum: [
      qtyColumn(
        'stageQtySum',
        workerColumnLabel('stageQtySum') ?? '',
        formattedValue(valueOf('stageQtySum'), formatQty),
      ),
    ],
    [STAGE_VALUE_NET_COLUMN_GROUP]: stageNetColumns(stages, valueOf, formatPLN),
    net: [moneyColumn('net', workerColumnLabel('net') ?? '', money('net'))],
    remainingForPlane: [moneyColumn('remainingForPlane', 'Pozostało', money('remainingForPlane'))],
  }
  return workerDocumentColumns(plane, columnRanks)
    .filter((key) => visible.has(key))
    .flatMap((key) => byKey[key] ?? [])
}
