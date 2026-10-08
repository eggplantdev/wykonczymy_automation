import { viewPrice, type PriceViewT } from '@/lib/kosztorys/calc'
import { computedColumnValues } from '@/lib/kosztorys/columns/column-values'
import { formatPercent } from '@/lib/kosztorys/format'
import { DISCOUNT_TYPE_LABELS } from '@/lib/kosztorys/labels'
import { clientDocumentColumns } from '@/lib/kosztorys/client-view/settings'
import { columnLabelForView } from '@/lib/kosztorys/columns/column-config'
import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/client-view/columns'
import {
  CURRENT_PLANNED_QTY_COLUMN,
  DESCRIPTION_COLUMN,
  NOTE_COLUMN,
  PLANNED_QTY_COLUMN,
  UNIT_COLUMN,
  computedMoneyColumn,
  computedQtyColumn,
  qtyColumn,
  stageNetColumns,
  stageQtyColumns,
  type PrintColumnT,
} from '@/lib/kosztorys/print/columns'
import { STAGE_VALUE_NET_COLUMN_GROUP, STAGES_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'
import { decimalText } from '@/lib/utils/decimal-text'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { ColumnRanksT } from '@/lib/table/column-order'

// A złoty, no grosze: the sheet's offer prints „19 495 zł" and a client reading a scope of works has
// no use for two decimals on 435 rows.
// The sums arrive already computed by the editor and are rounded here once, so adding the printed
// column by hand can land a few złotych off the printed total. Deliberate: the paper must agree with
// what the app shows, and the grid rounds its cells and its „Razem" independently too.
// `useGrouping: 'always'` against pl-PL's CLDR default: Polish sets minimumGroupingDigits=2, so a
// four-digit figure prints „1500" beside a grouped „12 745" and the column stops scanning as one.
// The owner's sheet groups every figure.
export const zloty = (n: number) =>
  `${Math.round(n).toLocaleString('pl-PL', { maximumFractionDigits: 0, useGrouping: 'always' })} zł`
// One constant for every figure on the offer: a plane repeated per column can be changed in four of
// five places, and the fifth would print one crew's stawka on a client's offer.
const OFFER_PRICE_VIEW: PriceViewT = 'client'
const clientLabel = (key: string) => columnLabelForView(key, OFFER_PRICE_VIEW)

// Every column of the client's document the paper can carry, keyed as CLIENT_DOCUMENT_COLUMNS names
// it; a stage group expands to one column per etap.
function offerColumnsByKey(stages: KosztorysStageT[]): Record<string, PrintColumnT[]> {
  const valueOf = computedColumnValues({ stages, view: OFFER_PRICE_VIEW })
  const money = computedMoneyColumn(valueOf, zloty)
  const donePercent = valueOf('donePercent')
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
    plannedNet: [money('plannedNet', 'Wartość netto')],
    currentPlannedNet: [money('currentPlannedNet', clientLabel('currentPlannedNet'))],
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
    discountAmount: [money('discountAmount', clientLabel('discountAmount'))],
    [STAGE_VALUE_NET_COLUMN_GROUP]: stageNetColumns(stages, valueOf, zloty),
    net: [money('net', clientLabel('net'))],
    donePercent: [
      qtyColumn('donePercent', clientLabel('donePercent'), (row) =>
        formatPercent(donePercent(row)),
      ),
    ],
    remaining: [money('remaining', 'Pozostało')],
  }
}

// The client's document on paper: `clientDocumentColumns`, the list the podgląd renders from, so
// „odznacz Cena j.m." in the dialog takes the column out of both and nothing can print in another
// order. Keyed per column group — a stage group's hide key is the group, not the etap.
export function offerPrintColumns(
  stages: KosztorysStageT[],
  hiddenColumns: readonly string[],
  columnRanks: ColumnRanksT,
): PrintColumnT[] {
  const byKey = offerColumnsByKey(stages)
  const visibleKeys = printableKeys(clientDocumentColumns(columnRanks), hiddenColumns)
  return visibleKeys.flatMap((key) => byKey[key] ?? [])
}

/**
 * The printed keys: the document's own list, minus what the owner hid, minus anything outside
 * `PREVIEW_VISIBLE_COLUMNS`.
 *
 * The ceiling is the point. The print is a render surface of its own, and the app's whole disclosure
 * regime lives in the render layer — the preview payload deliberately cuts nothing
 * (`preview-kosztorys.ts`). Without this filter a key slipped into the document list would be one
 * line from a client's document — „komentarz" or a subcontractor's stawka. Fails closed the same way
 * `sanitizeClientViewSettings` does.
 */
export function printableKeys(keys: readonly string[], hiddenColumns: readonly string[]): string[] {
  const hidden = new Set(hiddenColumns)
  return keys.filter((key) => PREVIEW_VISIBLE_COLUMNS.has(key) && !hidden.has(key))
}
