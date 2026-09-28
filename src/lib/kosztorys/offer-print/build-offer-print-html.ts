import { escapeHtml } from '@/lib/utils/escape-html'
import {
  OFFER_PRICE_VIEW,
  offerPrintColumns,
  type OfferColumnT,
  zloty,
} from '@/lib/kosztorys/offer-print/columns'
import { OFFER_PRINT_STYLES, WIDE_PRINT_STYLES } from '@/lib/kosztorys/offer-print/styles'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { bypassedByGlobalDiscount } from '@/lib/kosztorys/column-config'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import { applyRowConditions, clientConditionIds } from '@/lib/kosztorys/row-conditions/queries'
import { emptySettlementColumnIds } from '@/lib/kosztorys/settlement-columns'
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

/**
 * The pozycje an offer actually contains: the client's own hider and nothing else — `clientConditionIds`
 * owns which conditions may reach a client, and the grid's plane, search and the owner's own filters
 * are reading gestures that say nothing about what is being offered.
 *
 * Exported because the caller has to know whether there is an offer BEFORE it opens a print window:
 * a kosztorys whose every pozycja is empty on both axes passes a `rows.length` guard and prints a
 * branded header over an empty table.
 */
export function offeredRows(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  settings: ClientViewSettingsT,
): KosztorysV2RowT[] {
  return applyRowConditions(rows, clientConditionIds(settings.hideEmptyRows), {
    stages,
    hasSettledMaterial: false,
    divergentPriceRowIds: new Set(),
  })
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
  const empty = emptySettlementColumnIds(rows, stages)
  const globalDiscountActive = rows.some((row) => row.globalDiscountActive)
  const columns = offerPrintColumns(stages, settings.hiddenColumns, settings.columnRanks).filter(
    (column) =>
      !empty.has(column.key) && !bypassedByGlobalDiscount(column.key, globalDiscountActive),
  )
  return buildKosztorysPrintHtml({
    rows: offeredRows(rows, stages, settings),
    stages,
    columns,
    priceView: OFFER_PRICE_VIEW,
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

export type KosztorysPrintArgsT = {
  // Already the rows to print — which pozycje an audience sees is its own rule, decided by the caller.
  rows: KosztorysV2RowT[]
  stages: KosztorysStageT[]
  // Already capped by the audience's ceiling: this builder renders what it is handed and knows no
  // allowlist of its own.
  columns: readonly OfferColumnT[]
  priceView: PriceViewT
  documentKind: string
  title: string
  // The popup's `<title>` — what „Zapisz jako PDF" offers as the file name.
  pageTitle: string
  logoUrl: string
  fillByColorKey: ReadonlyMap<string, string>
  // The column whose figure the section totals sit under. Hidden, and the totals go with it.
  moneyKey: string
  money: (n: number) => string
  totalNet: number
  sectionNetById: ReadonlyMap<number, number>
  // Appended to the shared stylesheet, for a document whose shape the offer's page does not fit.
  extraStyles?: string
  // Replaces the „Razem netto" block — printed whether or not the money column survived, because it is
  // the audience's own balance, not a sum of the table.
  footerHtml?: string
}

export function buildKosztorysPrintHtml({
  rows,
  stages,
  columns,
  priceView,
  documentKind,
  title,
  pageTitle,
  logoUrl,
  fillByColorKey,
  moneyKey,
  money,
  totalNet,
  sectionNetById,
  extraStyles = '',
  footerHtml,
}: KosztorysPrintArgsT): string {
  // Every sum in the document is a sum of the money column. With it hidden the owner has decided the
  // reader sees no money, so the totals go with it rather than reappearing in a footer.
  // The index is what the section total is placed by — „Pozostało" sits to its right, so a figure
  // parked in the last cell would print the przedmiar's sum under the wrong heading.
  const moneyIndex = columns.findIndex((column) => column.key === moneyKey)
  const withMoney = moneyIndex >= 0

  const body: string[] = []
  let sectionId: number | null = null
  let sectionName = ''
  let sectionFill = 'transparent'

  const closeSection = () => {
    if (sectionId === null || !withMoney) return
    const sectionNet = sectionNetById.get(sectionId)
    if (sectionNet === undefined) return
    // Both documents pin „Opis prac" first, so the money column always has a label cell to its left.
    // The floor only guards a future caller whose list pins nothing: `colspan="0"` means „to the end
    // of the colgroup" in HTML5, and the browser would span the whole row. The filler count reads
    // the SAME span, not `moneyIndex`, so the two cannot disagree by one.
    const labelSpan = Math.max(1, moneyIndex)
    body.push(
      `<tr class="band-total">` +
        `<td class="rail" colspan="${labelSpan}" style="border-left-color:${escapeHtml(sectionFill)}">` +
        `Razem — ${escapeHtml(sectionName)}</td>` +
        `<td class="num">${money(sectionNet)}</td>` +
        `<td></td>`.repeat(Math.max(0, columns.length - labelSpan - 1)) +
        `</tr>`,
    )
  }

  for (const row of rows) {
    if (row.sectionId !== sectionId) {
      closeSection()
      sectionId = row.sectionId
      sectionName = row.sectionName
      sectionFill = (row.sectionColor && fillByColorKey.get(row.sectionColor)) || '#d4d4d8'
      body.push(
        `<tr class="band"><td colspan="${Math.max(1, columns.length)}">` +
          `<div class="band-inner" style="border-color:${escapeHtml(sectionFill)}">` +
          `<span class="band-chip" style="background:${escapeHtml(sectionFill)}"></span>` +
          `<span class="band-name">${escapeHtml(sectionName)}</span></div></td></tr>`,
      )
    }
    body.push(
      `<tr>` +
        columns
          .map(
            (column, index) =>
              `<td class="${column.cellClass}${index === 0 ? ' rail' : ''}"` +
              `${index === 0 ? ` style="border-left-color:${escapeHtml(sectionFill)}"` : ''}>` +
              `${column.cell(row, priceView, stages)}</td>`,
          )
          .join('') +
        `</tr>`,
    )
  }
  closeSection()

  const totals =
    footerHtml ??
    (withMoney
      ? `
<div class="totals"><table><tbody>
<tr class="grand"><td class="label">Razem netto</td><td class="value">${money(totalNet)}</td></tr>
</tbody></table></div>`
      : '')

  const brand =
    `<div class="brand-bar">` +
    `<img src="${escapeHtml(logoUrl)}" alt="">` +
    `<div class="brand-text"><div class="brand-kind">${escapeHtml(documentKind)}</div>` +
    `<div class="brand-title">${escapeHtml(title)}</div></div>` +
    `</div>`

  const head = `<tr>${columns
    .map(
      (column) =>
        `<th${column.headerClass ? ` class="${column.headerClass}"` : ''}><span>${escapeHtml(column.label)}</span></th>`,
    )
    .join('')}</tr>`

  const colgroup = `<colgroup>${columns
    .map((column) => `<col${column.colClass ? ` class="${column.colClass}"` : ''}>`)
    .join('')}</colgroup>`

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(pageTitle)}</title>
<style>${OFFER_PRINT_STYLES}${extraStyles}</style>
</head>
<body>
${brand}
<table>
${colgroup}
<thead>${head}</thead><tbody>${body.join('')}</tbody></table>
${totals}
</body>
</html>`
}
