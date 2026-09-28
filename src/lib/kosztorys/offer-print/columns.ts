import { escapeHtml } from '@/lib/utils/escape-html'
import {
  rowDiscountForView,
  rowDoneFraction,
  rowPlannedNetForView,
  stageValueForView,
  toGross,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { formatPercent, formatQty } from '@/lib/kosztorys/format'
import {
  rowRemainingForView,
  rowTotalQtyDone,
  rowValueForView,
} from '@/lib/kosztorys/settlement-rows'
import { clientDocumentColumns } from '@/lib/kosztorys/client-view-settings'
import { PREVIEW_VISIBLE_COLUMNS, columnLabelForView } from '@/lib/kosztorys/column-config'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGES_COLUMN_GROUP,
  stageKey,
  stageValueGrossKey,
  stageValueNetKey,
} from '@/lib/kosztorys/stage-keys'
import { decimalText } from '@/lib/utils/decimal-text'
import type { KosztorysStageT, KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'
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

export type OfferColumnT = {
  key: string
  label: string
  colClass: string
  cellClass: string
  headerClass: string
  cell: (row: KosztorysV2RowT, view: PriceViewT, stages: KosztorysStageT[]) => string
}

// The offer is priced for the client and nothing else. Passed to every `cell` by the builder rather
// than written into each one: a plane repeated per column can be changed in four of five places, and the
// fifth would print one crew's stawka on a client's offer.
export const OFFER_PRICE_VIEW: PriceViewT = 'client'

export const DESCRIPTION_COLUMN: OfferColumnT = {
  key: 'description',
  label: 'Opis prac',
  colClass: '',
  cellClass: 'desc',
  headerClass: '',
  cell: (row) => escapeHtml(row.description ?? ''),
}

export const PLANNED_QTY_COLUMN: OfferColumnT = {
  key: 'plannedQty',
  label: 'Przedmiar',
  colClass: 'c-qty',
  cellClass: 'num',
  headerClass: 'num',
  cell: (row) => escapeHtml(formatQty(row.plannedQty)),
}

export const UNIT_COLUMN: OfferColumnT = {
  key: 'unit',
  label: 'Jednostka miary',
  colClass: 'c-unit',
  cellClass: 'unit',
  headerClass: 'num',
  cell: (row) => escapeHtml(row.unit ?? ''),
}

export const moneyColumn = (
  key: string,
  label: string,
  cell: OfferColumnT['cell'],
): OfferColumnT => ({
  key,
  label,
  colClass: 'c-value',
  cellClass: 'num value',
  headerClass: 'num',
  cell,
})

export const qtyColumn = (
  key: string,
  label: string,
  cell: OfferColumnT['cell'],
): OfferColumnT => ({
  key,
  label,
  colClass: 'c-qty',
  cellClass: 'num',
  headerClass: 'num',
  cell,
})

const perStage = (
  stages: KosztorysStageT[],
  column: (stage: KosztorysStageT, qtyKey: StageKeyT) => OfferColumnT,
) => stages.map((stage) => column(stage, stageKey(stage.id)))

export const stageQtyColumns = (stages: KosztorysStageT[]): OfferColumnT[] =>
  perStage(stages, (stage, qtyKey) => ({
    key: qtyKey,
    label: stageLabel(stage),
    colClass: 'c-stage-qty',
    cellClass: 'num',
    headerClass: 'num',
    cell: (row) => (row[qtyKey] ? formatQty(row[qtyKey]) : ''),
  }))

// The share a stage's value is priced by, as the grid computes it.
const stageNetValue = (
  row: KosztorysV2RowT,
  qtyKey: StageKeyT,
  view: PriceViewT,
  printStages: KosztorysStageT[],
) => stageValueForView(row, row[qtyKey] ?? 0, rowTotalQtyDone(row, printStages, view), view)

export const stageNetColumns = (
  stages: KosztorysStageT[],
  money: (amount: number) => string,
): OfferColumnT[] =>
  perStage(stages, (stage, qtyKey) =>
    moneyColumn(
      stageValueNetKey(stage.id),
      `${stageLabel(stage)} netto`,
      (row, view, printStages) =>
        row[qtyKey] ? money(stageNetValue(row, qtyKey, view, printStages)) : '',
    ),
  )

const clientLabel = (key: string) => columnLabelForView(key, OFFER_PRICE_VIEW)

const DISCOUNT_TYPE_TEXT: Record<string, string> = { percent: '%', amount: 'zł' }

// Every column of the client's document the paper can carry, keyed as CLIENT_DOCUMENT_COLUMNS names
// it; a stage group expands to one column per etap.
function offerColumnsByKey(stages: KosztorysStageT[]): Record<string, OfferColumnT[]> {
  const discount = (row: KosztorysV2RowT, view: PriceViewT, printStages: KosztorysStageT[]) =>
    rowDiscountForView(row, rowTotalQtyDone(row, printStages, view), view)
  return {
    description: [DESCRIPTION_COLUMN],
    plannedQty: [PLANNED_QTY_COLUMN],
    unit: [UNIT_COLUMN],
    price: [
      {
        key: 'price',
        label: 'Cena j.m.',
        colClass: 'c-price',
        cellClass: 'num price',
        headerClass: 'num',
        cell: (row, view) => zloty(viewPrice(row, view)),
      },
    ],
    plannedNet: [
      moneyColumn('plannedNet', 'Wartość netto', (row, view) =>
        zloty(rowPlannedNetForView(row, view)),
      ),
    ],
    plannedGross: [
      moneyColumn('plannedGross', clientLabel('plannedGross'), (row, view) =>
        zloty(toGross(rowPlannedNetForView(row, view), row.vatRate)),
      ),
    ],
    [STAGES_COLUMN_GROUP]: stageQtyColumns(stages),
    stageQtySum: [
      qtyColumn('stageQtySum', clientLabel('stageQtySum'), (row, view, printStages) =>
        formatQty(rowTotalQtyDone(row, printStages, view)),
      ),
    ],
    priceGross: [
      {
        key: 'priceGross',
        label: clientLabel('priceGross'),
        colClass: 'c-price',
        cellClass: 'num price',
        headerClass: 'num',
        cell: (row, view) => zloty(toGross(viewPrice(row, view), row.vatRate)),
      },
    ],
    discountValue: [
      qtyColumn('discountValue', clientLabel('discountValue'), (row) =>
        decimalText(row.discountValue),
      ),
    ],
    discountType: [
      qtyColumn('discountType', clientLabel('discountType'), (row) =>
        row.discountType ? DISCOUNT_TYPE_TEXT[row.discountType] : '',
      ),
    ],
    discountAmount: [
      moneyColumn('discountAmount', clientLabel('discountAmount'), (row, view, printStages) =>
        zloty(discount(row, view, printStages)),
      ),
    ],
    discountAmountGross: [
      moneyColumn(
        'discountAmountGross',
        clientLabel('discountAmountGross'),
        (row, view, printStages) => zloty(toGross(discount(row, view, printStages), row.vatRate)),
      ),
    ],
    gross: [
      moneyColumn('gross', clientLabel('gross'), (row, view, printStages) =>
        zloty(toGross(rowValueForView(row, printStages, view), row.vatRate)),
      ),
    ],
    [STAGE_VALUE_NET_COLUMN_GROUP]: stageNetColumns(stages, zloty),
    net: [
      moneyColumn('net', clientLabel('net'), (row, view, printStages) =>
        zloty(rowValueForView(row, printStages, view)),
      ),
    ],
    [STAGE_VALUE_GROSS_COLUMN_GROUP]: perStage(stages, (stage, qtyKey) =>
      moneyColumn(
        stageValueGrossKey(stage.id),
        `${stageLabel(stage)} brutto`,
        (row, view, printStages) =>
          row[qtyKey]
            ? zloty(toGross(stageNetValue(row, qtyKey, view, printStages), row.vatRate))
            : '',
      ),
    ),
    donePercent: [
      qtyColumn('donePercent', clientLabel('donePercent'), (row, _view, printStages) =>
        formatPercent(rowDoneFraction(row, rowTotalQtyDone(row, printStages, 'client'))),
      ),
    ],
    remaining: [
      moneyColumn('remaining', 'Pozostało', (row, view, printStages) =>
        zloty(rowRemainingForView(row, printStages, view)),
      ),
    ],
    remainingGross: [
      moneyColumn('remainingGross', clientLabel('remainingGross'), (row, view, printStages) =>
        zloty(toGross(rowRemainingForView(row, printStages, view), row.vatRate)),
      ),
    ],
  }
}

// The client's document on paper: `clientDocumentColumns`, the list the podgląd renders from, so
// „odznacz Cena j.m." in the dialog takes the column out of both and nothing can print in another
// order. Keyed per column group — a stage group's hide key is the group, not the etap.
export function offerPrintColumns(
  stages: KosztorysStageT[],
  hiddenColumns: readonly string[],
  columnRanks: ColumnRanksT,
): OfferColumnT[] {
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
