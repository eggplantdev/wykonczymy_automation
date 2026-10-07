import { buildKosztorysPrintHtml } from '@/lib/kosztorys/print/build-html'
import { documentRows } from '@/lib/kosztorys/print/document-rows'
import { offerPrintColumns, zloty } from '@/lib/kosztorys/print/offer-columns'
import { WIDE_PRINT_STYLES } from '@/lib/kosztorys/print/styles'
import { bypassedByGlobalDiscount } from '@/lib/kosztorys/columns/column-config'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'
import { investorEmptyColumnIds } from '@/lib/kosztorys/settlement-columns'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

export type OfferPrintArgsT = {
  rows: KosztorysV2RowT[]
  stages: KosztorysStageT[]
  // The investment's stored client-view settings — the same ones the podgląd and the shared link
  // obey. The offer is that document on paper, so it asks them rather than deciding for itself.
  settings: ClientViewSettingsT
  investmentName: string
  logoUrl: string
  // Resolved CSS colours keyed by the section's palette key — the popup is its own document with no
  // stylesheet, so the `--color-section-*` vars have to arrive already computed. A Map, not a
  // `Record`: `sectionColor` comes off a row, and `'__proto__'` on an object literal reaches
  // `Object.prototype` instead of missing.
  fillByColorKey: ReadonlyMap<string, string>
  // „Razem" under „Wartość netto przedmiar", straight from the editor. The print does not add up its
  // own rows: the same figure summed twice is the one way paper and screen can disagree.
  totalNet: number
  // The same figure per section, keyed by `sectionId`. A section with no entry gets no total row —
  // an absent figure is honester than a printed `0 zł`.
  sectionNetById: ReadonlyMap<number, number>
}

// The default offer's six columns fit portrait with the opis still ~70mm; a seventh leaves it ~47mm.
// Past that the owner has widened the document with etap columns and it turns landscape.
const PORTRAIT_COLUMN_LIMIT = 7

export function buildOfferPrintHtml({
  rows,
  stages,
  settings,
  investmentName,
  logoUrl,
  fillByColorKey,
  totalNet,
  sectionNetById,
}: OfferPrintArgsT): string {
  // Before the portrait/landscape count, so an offer with no entries prints as narrow as it reads.
  const empty = investorEmptyColumnIds(rows, stages)
  const globalDiscountActive = rows.some((row) => row.globalDiscountActive)
  const columns = offerPrintColumns(stages, settings.hiddenColumns, settings.columnRanks).filter(
    (column) =>
      !empty.has(column.key) && !bypassedByGlobalDiscount(column.key, globalDiscountActive),
  )
  return buildKosztorysPrintHtml({
    rows: documentRows(rows, stages, settings.hideEmptyRows),
    columns,
    documentKind: 'Kosztorys ofertowy',
    title: investmentName,
    pageTitle: investmentName,
    logoUrl,
    fillByColorKey,
    moneyKey: 'plannedNet',
    money: zloty,
    totalNet,
    sectionNetById,
    extraStyles: columns.length > PORTRAIT_COLUMN_LIMIT ? WIDE_PRINT_STYLES : '',
  })
}
