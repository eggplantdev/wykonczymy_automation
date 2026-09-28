import { escapeHtml } from '@/lib/utils/escape-html'
import {
  OFFER_COLUMNS,
  OFFER_PRICE_VIEW,
  printableOfferColumns,
  zloty,
} from '@/lib/kosztorys/offer-print/columns'
import { OFFER_PRINT_STYLES } from '@/lib/kosztorys/offer-print/styles'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import { applyRowConditions, clientConditionIds } from '@/lib/kosztorys/row-conditions/queries'
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
  const columns = printableOfferColumns(OFFER_COLUMNS, settings.hiddenColumns)
  // Every sum in the document is a sum of „Wartość netto". With that column hidden the owner has
  // decided the client sees no money, so the totals go with it rather than reappearing in a footer.
  // The index is what the section total is placed by — „Pozostało" sits to its right, so a figure
  // parked in the last cell would print the przedmiar's sum under the wrong heading.
  const moneyIndex = columns.findIndex((column) => column.key === 'plannedNet')
  const withMoney = moneyIndex >= 0

  const offered = offeredRows(rows, stages, settings)

  const body: string[] = []
  let sectionId: number | null = null
  let sectionName = ''
  let sectionFill = 'transparent'

  const closeSection = () => {
    if (sectionId === null || !withMoney) return
    const sectionNet = sectionNetById.get(sectionId)
    if (sectionNet === undefined) return
    // Never 0: with „Opis prac" hidden the label may have no column left to its own, and
    // `colspan="0"` means „to the end of the colgroup" in HTML5 — the browser spans the row. The
    // filler count reads the SAME span, not `moneyIndex`: hide everything left of „Wartość netto"
    // and the two disagreed by one, so the row carried a phantom column past the colgroup.
    const labelSpan = Math.max(1, moneyIndex)
    body.push(
      `<tr class="band-total">` +
        `<td class="rail" colspan="${labelSpan}" style="border-left-color:${escapeHtml(sectionFill)}">` +
        `Razem — ${escapeHtml(sectionName)}</td>` +
        `<td class="num">${zloty(sectionNet)}</td>` +
        `<td></td>`.repeat(Math.max(0, columns.length - labelSpan - 1)) +
        `</tr>`,
    )
  }

  for (const row of offered) {
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
              `${column.cell(row, OFFER_PRICE_VIEW, stages)}</td>`,
          )
          .join('') +
        `</tr>`,
    )
  }
  closeSection()

  const totals = withMoney
    ? `
<div class="totals"><table><tbody>
<tr class="grand"><td class="label">Razem netto</td><td class="value">${zloty(totalNet)}</td></tr>
</tbody></table></div>`
    : ''

  const brand =
    `<div class="brand-bar">` +
    `<img src="${escapeHtml(logoUrl)}" alt="">` +
    `<div class="brand-text"><div class="brand-kind">Kosztorys ofertowy</div>` +
    `<div class="brand-title">${escapeHtml(investmentName)}</div></div>` +
    `</div>`

  const head = `<tr>${columns
    .map(
      (column) =>
        `<th${column.headerClass ? ` class="${column.headerClass}"` : ''}>${escapeHtml(column.label)}</th>`,
    )
    .join('')}</tr>`

  const colgroup = `<colgroup>${columns
    .map((column) => `<col${column.colClass ? ` class="${column.colClass}"` : ''}>`)
    .join('')}</colgroup>`

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(investmentName)}</title>
<style>${OFFER_PRINT_STYLES}</style>
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
