import { rowPlannedNetForView, stageValueForView, viewPrice } from '@/lib/kosztorys/calc'
import { formatQty } from '@/lib/kosztorys/format'
import {
  DESCRIPTION_COLUMN,
  PLANNED_QTY_COLUMN,
  UNIT_COLUMN,
  type OfferColumnT,
} from '@/lib/kosztorys/offer-print/columns'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  rowRemainingForExecutedQty,
  rowTotalQtyDone,
  rowValueForView,
} from '@/lib/kosztorys/settlement-rows'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import {
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGES_COLUMN_GROUP,
  stageKey,
  stageValueNetKey,
} from '@/lib/kosztorys/stage-keys'
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

const moneyColumn = (key: string, label: string, cell: OfferColumnT['cell']): OfferColumnT => ({
  key,
  label,
  colClass: 'c-value',
  cellClass: 'num value',
  headerClass: 'num',
  cell,
})

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
    [STAGES_COLUMN_GROUP]: stages.map((stage) => {
      const qtyKey = stageKey(stage.id)
      return {
        key: qtyKey,
        label: stageLabel(stage),
        colClass: 'c-stage-qty',
        cellClass: 'num',
        headerClass: 'num',
        cell: (row) => (row[qtyKey] ? formatQty(row[qtyKey]) : ''),
      }
    }),
    stageQtySum: [
      {
        key: 'stageQtySum',
        label: workerColumnLabel('stageQtySum') ?? '',
        colClass: 'c-qty',
        cellClass: 'num',
        headerClass: 'num',
        cell: (row, view, printStages) => formatQty(rowTotalQtyDone(row, printStages, view)),
      },
    ],
    [STAGE_VALUE_NET_COLUMN_GROUP]: stages.map((stage) => {
      const qtyKey = stageKey(stage.id)
      return moneyColumn(
        stageValueNetKey(stage.id),
        `${stageLabel(stage)} netto`,
        (row, view, printStages) =>
          row[qtyKey]
            ? formatPLN(
                stageValueForView(row, row[qtyKey], rowTotalQtyDone(row, printStages, view), view),
              )
            : '',
      )
    }),
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
