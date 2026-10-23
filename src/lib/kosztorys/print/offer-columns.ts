import { viewPrice, type PriceViewT } from '@/lib/kosztorys/calc'
import { computedColumnValues } from '@/lib/kosztorys/columns/column-values'
import { DISCOUNT_TYPE_LABELS } from '@/lib/kosztorys/labels'
import { clientDocumentColumns } from '@/lib/kosztorys/client-view/settings'
import { columnLabelForView, withAfterDiscountSuffix } from '@/lib/kosztorys/columns/column-config'
import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/client-view/columns'
import {
  CURRENT_PLANNED_QTY_COLUMN,
  DESCRIPTION_COLUMN,
  NOTE_COLUMN,
  PLANNED_QTY_COLUMN,
  UNIT_COLUMN,
  computedMoneyColumn,
  computedPercentColumn,
  computedQtyColumn,
  qtyColumn,
  stageGrossColumns,
  stageNetColumns,
  stageQtyColumns,
  type PrintColumnT,
} from '@/lib/kosztorys/print/columns'
import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGES_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'
import { decimalText } from '@/lib/utils/decimal-text'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { ColumnRanksT } from '@/lib/table/column-order'

// `useGrouping: 'always'` against pl-PL's CLDR default: Polish sets minimumGroupingDigits=2, so a
// four-digit figure prints „1500" beside a grouped „12 745" and the column stops scanning as one.
export const zloty = (n: number) =>
  `${Math.round(n).toLocaleString('pl-PL', { maximumFractionDigits: 0, useGrouping: 'always' })} zł`
const OFFER_PRICE_VIEW: PriceViewT = 'client'

function offerColumnsByKey(
  stages: KosztorysStageT[],
  hasDiscount: boolean,
): Record<string, PrintColumnT[]> {
  const clientLabel = (key: string) =>
    columnLabelForView(key, OFFER_PRICE_VIEW, undefined, { hasDiscount })
  const valueOf = computedColumnValues({ stages, view: OFFER_PRICE_VIEW })
  const money = computedMoneyColumn(valueOf, zloty)
  const percent = computedPercentColumn(valueOf)
  return {
    description: [DESCRIPTION_COLUMN],
    note: [NOTE_COLUMN],
    plannedQty: [PLANNED_QTY_COLUMN],
    currentPlannedQty: [CURRENT_PLANNED_QTY_COLUMN],
    unit: [UNIT_COLUMN],
    price: [
      {
        key: 'price',
        label: 'Cena j.m.',
        colClass: 'c-price',
        cellClass: 'num price',
        headerClass: 'num',
        cell: (row) => zloty(viewPrice(row, OFFER_PRICE_VIEW)),
      },
    ],
    priceGross: [money('priceGross', clientLabel('priceGross'))],
    plannedNet: [
      money(
        'plannedNet',
        withAfterDiscountSuffix('plannedNet', 'Wartość netto', OFFER_PRICE_VIEW, hasDiscount),
      ),
    ],
    plannedGross: [
      money(
        'plannedGross',
        withAfterDiscountSuffix('plannedGross', 'Wartość brutto', OFFER_PRICE_VIEW, hasDiscount),
      ),
    ],
    currentPlannedNet: [money('currentPlannedNet', clientLabel('currentPlannedNet'))],
    currentPlannedGross: [money('currentPlannedGross', clientLabel('currentPlannedGross'))],
    [STAGES_COLUMN_GROUP]: stageQtyColumns(stages),
    stageQtySum: [computedQtyColumn(valueOf)('stageQtySum', clientLabel('stageQtySum'))],
    discountValue: [
      qtyColumn('discountValue', clientLabel('discountValue'), (row) =>
        decimalText(row.discountValue),
      ),
    ],
    discountType: [
      qtyColumn('discountType', clientLabel('discountType'), (row) =>
        row.discountType ? DISCOUNT_TYPE_LABELS[row.discountType] : '',
      ),
    ],
    plannedDiscountAmount: [money('plannedDiscountAmount', clientLabel('plannedDiscountAmount'))],
    plannedDiscountAmountGross: [
      money('plannedDiscountAmountGross', clientLabel('plannedDiscountAmountGross')),
    ],
    discountAmount: [money('discountAmount', clientLabel('discountAmount'))],
    discountAmountGross: [money('discountAmountGross', clientLabel('discountAmountGross'))],
    [STAGE_VALUE_NET_COLUMN_GROUP]: stageNetColumns(stages, valueOf, zloty),
    [STAGE_VALUE_GROSS_COLUMN_GROUP]: stageGrossColumns(stages, valueOf, zloty),
    net: [money('net', clientLabel('net'))],
    gross: [money('gross', clientLabel('gross'))],
    // „wg" only on paper: with „względem" the rotated headers of these narrow columns overprint each other.
    donePercent: [percent('donePercent', '% wykonania (wg aktualizacji przedmiaru)')],
    plannedDonePercent: [percent('plannedDonePercent', '% wykonania (wg przedmiaru ofertowego)')],
    remaining: [money('remaining', 'Pozostało')],
    remainingGross: [money('remainingGross', 'Pozostało brutto')],
  }
}

export function offerPrintColumns(
  stages: KosztorysStageT[],
  hiddenColumns: readonly string[],
  columnRanks: ColumnRanksT,
  hasDiscount: boolean,
): PrintColumnT[] {
  const byKey = offerColumnsByKey(stages, hasDiscount)
  const visibleKeys = printableKeys(clientDocumentColumns(columnRanks), hiddenColumns)
  return visibleKeys.flatMap((key) => byKey[key] ?? [])
}

// Without this filter a key slipped into the document list would be one line from a client's
// document — „komentarz" or a subcontractor's stawka.
export function printableKeys(keys: readonly string[], hiddenColumns: readonly string[]): string[] {
  const hidden = new Set(hiddenColumns)
  return keys.filter((key) => PREVIEW_VISIBLE_COLUMNS.has(key) && !hidden.has(key))
}
