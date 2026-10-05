import type { TranslatorT } from '@/lib/i18n/translations'
import { viewPrice } from '@/lib/kosztorys/calc'
import { columnLabelForView } from '@/lib/kosztorys/columns/column-config'
import { computedColumnValues } from '@/lib/kosztorys/columns/column-values'
import {
  DESCRIPTION_COLUMN,
  PLANNED_QTY_COLUMN,
  UNIT_COLUMN,
  computedMoneyColumn,
  computedQtyColumn,
  moneyColumn,
  stageNetColumns,
  stageQtyColumns,
  type PrintColumnT,
} from '@/lib/kosztorys/print/columns'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { STAGE_VALUE_NET_COLUMN_GROUP, STAGES_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'
import { workerDocumentColumns, workerVisibleColumns } from '@/lib/kosztorys/worker-view/settings'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import { formatPLN } from '@/lib/utils/format-currency'
import type { ColumnRanksT } from '@/lib/table/column-order'

export type WorkerPrintColumnsArgsT = {
  plane: ToolPlaneT
  // Only the worker's own etapy — the projection's `tree.stages`.
  stages: KosztorysStageT[]
  hiddenColumns: readonly string[]
  columnRanks: ColumnRanksT
  executedQtyByItem: Record<number, number>
  dictionary: TranslatorT<'grid'>
}

/**
 * The worker's printed columns: `workerDocumentColumns`, the list their podgląd renders from, capped by
 * `workerVisibleColumns` — so the paper can neither carry a column the settings bar from the screen
 * nor print one in another place. Priced in grosze, unlike the offer: a stawka of 7,50 zł rounded to
 * „8 zł" is a different rate, not a tidier one. Every header is the link's, in the worker's language.
 */
export function workerPrintColumns({
  plane,
  stages,
  hiddenColumns,
  columnRanks,
  executedQtyByItem,
  dictionary,
}: WorkerPrintColumnsArgsT): PrintColumnT[] {
  const visible = workerVisibleColumns(plane, hiddenColumns)
  const rateKey = planePriceKey('price', plane)
  const valueOf = computedColumnValues({ stages, view: plane, executedQtyByItem })
  const money = computedMoneyColumn(valueOf, formatPLN)
  const labelOf = (key: string) => columnLabelForView(key, plane, dictionary)
  const byKey: Record<string, PrintColumnT[]> = {
    description: [{ ...DESCRIPTION_COLUMN, label: labelOf('description') }],
    plannedQty: [{ ...PLANNED_QTY_COLUMN, label: labelOf('plannedQty') }],
    unit: [{ ...UNIT_COLUMN, label: labelOf('unit') }],
    [rateKey]: [
      {
        ...moneyColumn(rateKey, labelOf(rateKey), (row) => formatPLN(viewPrice(row, plane))),
        cellClass: 'num price',
      },
    ],
    plannedNetForPlane: [money('plannedNetForPlane', labelOf('plannedNetForPlane'))],
    [STAGES_COLUMN_GROUP]: stageQtyColumns(stages, dictionary),
    stageQtySum: [computedQtyColumn(valueOf)('stageQtySum', labelOf('stageQtySum'))],
    [STAGE_VALUE_NET_COLUMN_GROUP]: stageNetColumns(stages, valueOf, formatPLN, dictionary),
    net: [money('net', labelOf('net'))],
    remainingForPlane: [money('remainingForPlane', labelOf('remainingForPlane'))],
  }
  return workerDocumentColumns(plane, columnRanks)
    .filter((key) => visible.has(key))
    .flatMap((key) => byKey[key] ?? [])
}
