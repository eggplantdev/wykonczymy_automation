import { escapeHtml } from '@/lib/utils/escape-html'
import type { LanguageT } from '@/lib/i18n/languages'
import type { PrintColumnT } from '@/lib/kosztorys/print/columns'
import { PRINT_STYLES } from '@/lib/kosztorys/print/styles'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

type KosztorysPrintArgsT = {
  rows: KosztorysV2RowT[]
  columns: readonly PrintColumnT[]
  documentKind: string
  title: string
  // The popup's `<title>` — what „Zapisz jako PDF" offers as the file name.
  pageTitle: string
  logoUrl: string
  fillByColorKey: ReadonlyMap<string, string>
  totalKeys: readonly string[]
  money: (n: number) => string
  sectionTotalsById: ReadonlyMap<number, ReadonlyMap<string, number>>
  // In-table, under each total column; without it the document closes on the „Razem netto" box.
  grandTotals?: ReadonlyMap<string, number>
  totalNet?: number
  extraStyles?: string
  footerHtml?: string
  lang?: LanguageT
  totalLabel?: string
  stripeParity?: 0 | 1
}

export function buildKosztorysPrintHtml({
  rows,
  columns,
  documentKind,
  title,
  pageTitle,
  logoUrl,
  fillByColorKey,
  totalKeys,
  money,
  sectionTotalsById,
  grandTotals,
  totalNet,
  extraStyles = '',
  footerHtml,
  stripeParity = 1,
  lang = 'pl',
  totalLabel = 'Razem',
}: KosztorysPrintArgsT): string {
  const stripe = (index: number) => (index % 2 === stripeParity ? ' stripe' : '')
  const moneyIndex = columns.findIndex((column) => totalKeys.includes(column.key))
  const withMoney = moneyIndex >= 0
  // `colspan="0"` means „to the end of the colgroup" in HTML5, and the browser would span the
  // whole row.
  const labelSpan = Math.max(1, moneyIndex)
  const totalCells = (totals: ReadonlyMap<string, number>) =>
    columns
      .slice(labelSpan)
      .map((column) => {
        const total = totalKeys.includes(column.key) ? totals.get(column.key) : undefined
        return total === undefined ? '<td></td>' : `<td class="num">${money(total)}</td>`
      })
      .join('')

  const colgroup = `<colgroup>${columns
    .map((column) => `<col${column.colClass ? ` class="${column.colClass}"` : ''}>`)
    .join('')}</colgroup>`
  // WebKit ignores `break-inside` on a table row and paginates each cell's lines on its own, so Safari
  // printed a row's opis on the next page and its figures on this one; a whole table it keeps together.
  const body: string[] = []
  const pushRow = (tr: string, tableClass = 'row') =>
    body.push(`<table class="${tableClass}">${colgroup}<tbody>${tr}</tbody></table>`)
  let sectionId: number | null = null
  let sectionName = ''
  let sectionFill = 'transparent'

  const closeSection = () => {
    if (sectionId === null || !withMoney) return
    const sectionTotals = sectionTotalsById.get(sectionId)
    if (sectionTotals === undefined) return
    pushRow(
      `<tr class="band-total">` +
        `<td class="rail" colspan="${labelSpan}" style="border-left-color:${escapeHtml(sectionFill)}">` +
        `${escapeHtml(totalLabel)} — ${escapeHtml(sectionName)}</td>` +
        totalCells(sectionTotals) +
        `</tr>`,
    )
  }

  for (const row of rows) {
    if (row.sectionId !== sectionId) {
      closeSection()
      sectionId = row.sectionId
      sectionName = row.sectionName
      sectionFill = (row.sectionColor && fillByColorKey.get(row.sectionColor)) || '#a1a1aa'
      pushRow(
        `<tr class="band"><td colspan="${Math.max(1, columns.length)}">` +
          `<div class="band-inner" style="border-color:${escapeHtml(sectionFill)}">` +
          `<span class="band-chip" style="background:${escapeHtml(sectionFill)}"></span>` +
          `<span class="band-name">${escapeHtml(sectionName)}</span></div></td></tr>`,
        'row band-row',
      )
    }
    pushRow(
      `<tr>` +
        columns
          .map(
            (column, index) =>
              `<td class="${column.cellClass}${index === 0 ? ' rail' : ''}${stripe(index)}"` +
              `${index === 0 ? ` style="border-left-color:${escapeHtml(sectionFill)}"` : ''}>` +
              `${column.cell(row)}</td>`,
          )
          .join('') +
        `</tr>`,
    )
  }
  closeSection()
  if (withMoney && grandTotals) {
    pushRow(
      `<tr class="grand-total"><td colspan="${labelSpan}">${escapeHtml(totalLabel)}</td>` +
        totalCells(grandTotals) +
        `</tr>`,
      'row grand-row',
    )
  }

  const totals =
    footerHtml ??
    (withMoney && totalNet !== undefined
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
    .map((column, index) => {
      const headerClass = `${column.headerClass}${stripe(index)}`.trim()
      return `<th${headerClass ? ` class="${headerClass}"` : ''}><span>${escapeHtml(column.label)}</span></th>`
    })
    .join('')}</tr>`

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(pageTitle)}</title>
<style>${PRINT_STYLES}${extraStyles}</style>
</head>
<body>
${brand}
<table class="sheet">
<thead><tr class="sheet-head"><td class="sheet-cell"><table>${colgroup}<thead>${head}</thead></table></td></tr></thead>
<tbody><tr class="sheet-body"><td class="sheet-cell">${body.join('')}</td></tr></tbody></table>
${totals}
</body>
</html>`
}
