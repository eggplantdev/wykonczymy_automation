import { escapeHtml } from '@/lib/utils/escape-html'
import { rowPlannedNetForView, viewPrice, type PriceViewT } from '@/lib/kosztorys/calc'
import { formatQty } from '@/lib/kosztorys/format'
import { rowRemainingForView } from '@/lib/kosztorys/settlement-rows'
import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

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

// The three columns every printed kosztorys opens with, whoever it is priced for — exported for the
// worker print, which puts its own money columns after them.
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

// Keyed by the same column keys the client-view settings hide, so „odznacz Cena j.m." in the dialog
// takes the column out of the printed offer too. The offer never prints the whole allowlist — the
// stage columns are a settlement document, not an offer — so the printed set is this list minus
// whatever the owner hid, minus whatever the ceiling below bars outright.
export const OFFER_COLUMNS: readonly OfferColumnT[] = [
  DESCRIPTION_COLUMN,
  PLANNED_QTY_COLUMN,
  UNIT_COLUMN,
  {
    key: 'price',
    label: 'Cena j.m.',
    colClass: 'c-price',
    cellClass: 'num price',
    headerClass: 'num',
    cell: (row, view) => zloty(viewPrice(row, view)),
  },
  {
    key: 'plannedNet',
    label: 'Wartość netto',
    colClass: 'c-value',
    cellClass: 'num value',
    headerClass: 'num',
    cell: (row, view) => zloty(rowPlannedNetForView(row, view)),
  },
  {
    key: 'remaining',
    label: 'Pozostało',
    colClass: 'c-value',
    cellClass: 'num value',
    headerClass: 'num',
    cell: (row, view, stages) => zloty(rowRemainingForView(row, stages, view)),
  },
]

// Exported for the spec that pins the list against the ceiling — the assertion has to see the keys.
export const OFFER_COLUMN_KEYS: readonly string[] = OFFER_COLUMNS.map((column) => column.key)

/**
 * The printed column set: the offer's own list, minus what the owner hid, minus anything outside
 * `PREVIEW_VISIBLE_COLUMNS`.
 *
 * The ceiling is the point. The print is a render surface of its own, and the app's whole disclosure
 * regime lives in the render layer — the preview payload deliberately cuts nothing
 * (`preview-kosztorys.ts`). Without this filter `OFFER_COLUMNS` would be a third hand-maintained
 * allowlist nothing checks, and „komentarz" or a subcontractor's stawka would be one line from a
 * client's document. Fails closed the same way `sanitizeClientViewVariant` does.
 */
export function printableOfferColumns(
  columns: readonly OfferColumnT[],
  hiddenColumns: readonly string[],
): OfferColumnT[] {
  const hidden = new Set(hiddenColumns)
  return columns.filter(
    (column) => PREVIEW_VISIBLE_COLUMNS.has(column.key) && !hidden.has(column.key),
  )
}
