import { escapeHtml } from '@/lib/utils/escape-html'
import type { PrintColumnT } from '@/lib/kosztorys/print/columns'
import { PRINT_STYLES } from '@/lib/kosztorys/print/styles'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

type KosztorysPrintArgsT = {
  // Already the rows to print — which pozycje an audience sees is its own rule, decided by the caller.
  rows: KosztorysV2RowT[]
  // Already capped by the audience's ceiling: this builder renders what it is handed and knows no
  // allowlist of its own.
  columns: readonly PrintColumnT[]
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
  columns,
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
              `${column.cell(row)}</td>`,
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
<style>${PRINT_STYLES}${extraStyles}</style>
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
