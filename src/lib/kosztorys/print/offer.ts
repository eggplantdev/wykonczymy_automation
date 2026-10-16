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
  settings: ClientViewSettingsT
  investmentName: string
  logoUrl: string
  // A Map, not a `Record`: `sectionColor` comes off a row, and `'__proto__'` on an object literal reaches
  // `Object.prototype` instead of missing.
  fillByColorKey: ReadonlyMap<string, string>
  totalNet: number
  sectionNetById: ReadonlyMap<number, number>
}

// The default offer's six columns fit portrait with the opis still ~70mm; a seventh leaves it ~47mm.
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
