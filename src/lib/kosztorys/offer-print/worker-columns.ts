import { rowPlannedNetForView, stageValueForView, viewPrice } from '@/lib/kosztorys/calc'
import { formatQty } from '@/lib/kosztorys/format'
import {
  DESCRIPTION_COLUMN,
  PLANNED_QTY_COLUMN,
  UNIT_COLUMN,
  type OfferColumnT,
} from '@/lib/kosztorys/offer-print/columns'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { rowRemainingForExecutedQty, rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import {
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGES_COLUMN_GROUP,
  stageKey,
  stageValueNetKey,
} from '@/lib/kosztorys/stage-keys'
import { workerVisibleColumns } from '@/lib/kosztorys/worker-view/settings'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import { formatPLN } from '@/lib/utils/format-currency'

export type WorkerPrintColumnsArgsT = {
  plane: ToolPlaneT
  // His etapy only — the projection's `tree.stages`.
  stages: KosztorysStageT[]
  hiddenColumns: readonly string[]
  executedQtyByItem: Record<number, number>
}

const moneyColumn = (
  key: string,
  label: string,
  cell: OfferColumnT['cell'],
  colClass = 'c-value',
): OfferColumnT => ({ key, label, colClass, cellClass: 'num value', headerClass: 'num', cell })

/**
 * The worker's printed columns, capped by `workerVisibleColumns` — the same ceiling his link renders
 * through, so the paper cannot carry a column the settings bar from the screen. Priced in grosze,
 * unlike the offer: a stawka of 7,50 zł rounded to „8 zł" is a different rate, not a tidier one.
 *
 * „Σ etapów" and „Wartość wykonana" are left off the paper: the per-etap columns and the footer
 * carry both, and a landscape page has no width to spend on them twice.
 */
export function workerPrintColumns({
  plane,
  stages,
  hiddenColumns,
  executedQtyByItem,
}: WorkerPrintColumnsArgsT): OfferColumnT[] {
  const visible = workerVisibleColumns(plane, hiddenColumns)
  const rateKey = planePriceKey('price', plane)
  // Keyed by what the ceiling names: a per-etap column answers to its group, as in the grid.
  const candidates: [string, OfferColumnT][] = [
    ['description', DESCRIPTION_COLUMN],
    ['plannedQty', PLANNED_QTY_COLUMN],
    ['unit', UNIT_COLUMN],
    [
      rateKey,
      {
        ...moneyColumn(rateKey, 'Stawka j.m.', (row, view) => formatPLN(viewPrice(row, view))),
        cellClass: 'num price',
      },
    ],
    [
      'plannedNetForPlane',
      moneyColumn('plannedNetForPlane', 'Wartość przedmiaru', (row, view) =>
        formatPLN(rowPlannedNetForView(row, view)),
      ),
    ],
    ...stages.flatMap((stage): [string, OfferColumnT][] => {
      const qtyKey = stageKey(stage.id)
      return [
        [
          STAGES_COLUMN_GROUP,
          {
            key: qtyKey,
            label: stageLabel(stage),
            colClass: 'c-qty',
            cellClass: 'num',
            headerClass: 'num',
            cell: (row) => (row[qtyKey] ? formatQty(row[qtyKey]) : ''),
          },
        ],
        [
          STAGE_VALUE_NET_COLUMN_GROUP,
          moneyColumn(
            stageValueNetKey(stage.id),
            `${stageLabel(stage)} — wartość`,
            (row, view, printStages) =>
              row[qtyKey]
                ? formatPLN(
                    stageValueForView(
                      row,
                      row[qtyKey],
                      rowTotalQtyDone(row, printStages, view),
                      view,
                    ),
                  )
                : '',
          ),
        ],
      ]
    }),
    [
      'remainingForPlane',
      moneyColumn('remainingForPlane', 'Pozostało', (row, view) =>
        formatPLN(rowRemainingForExecutedQty(row, executedQtyByItem[row.id] ?? 0, view)),
      ),
    ],
  ]
  return candidates
    .filter(([visibilityKey]) => visible.has(visibilityKey))
    .map(([, column]) => column)
}
