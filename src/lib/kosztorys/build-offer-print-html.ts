import { escapeHtml } from '@/lib/utils/escape-html'
import { rowPlannedNetForView, viewPrice, type PriceViewT } from '@/lib/kosztorys/calc'
import { formatQty } from '@/lib/kosztorys/format'
import { rowRemainingForView } from '@/lib/kosztorys/settlement-rows'
import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'
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

// A złoty, no grosze: the sheet's offer prints „19 495 zł" and a client reading a scope of works has
// no use for two decimals on 435 rows.
// The sums arrive already computed by the editor and are rounded here once, so adding the printed
// column by hand can land a few złotych off the printed total. Deliberate: the paper must agree with
// what the app shows, and the grid rounds its cells and its „Razem" independently too.
// `useGrouping: 'always'` against pl-PL's CLDR default: Polish sets minimumGroupingDigits=2, so a
// four-digit figure prints „1500" beside a grouped „12 745" and the column stops scanning as one.
// The owner's sheet groups every figure.
const zloty = (n: number) =>
  `${Math.round(n).toLocaleString('pl-PL', { maximumFractionDigits: 0, useGrouping: 'always' })} zł`

const STYLES = `
/* Browsers drop every background when printing unless the document says the colour IS the content.
   Without this the section bands print white and a 150-row offer loses the only cue that tells one
   section from the next. */
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* Split deliberately between @page and body. The print dialog's own „Marginesy" dropdown OVERRIDES
   @page — set to „Brak" it drops it whole and the value column prints clipped at the sheet edge. The
   horizontal inset therefore lives on the body, where nothing can take it away; @page carries only
   the vertical half, which a continuation page needs above its repeating header. */
/* An empty margin box makes Chrome 131+ / Safari 18.2+ drop their own „Nagłówki i stopki" on that edge
   (title + date on top, URL + page count below) whatever the dialog's checkbox says — hence one per
   edge. An offer is not a browser printout. */
@page {
  margin: 16mm 0 12mm;
  @top-center { content: ''; }
  @bottom-center { content: ''; }
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 8pt; line-height: 1.4; color: #18181b; margin: 0; padding: 6mm 18mm;
  font-variant-numeric: tabular-nums;
}

/* separate, not collapse: collapsing centres every border ON the grid line, so the rail's 2px and the
   band's identical border land in different places and a plain hairline can outvote a section's
   colour. Nothing doubles at zero border-spacing — each edge is declared by one side only. */
table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
/* Auto layout sizes a column by its widest cell, so „kontener" and „1 500 zł" claimed width the wrapped
   descriptions needed far more. The figures are known-width; the description takes the remainder. */
col.c-qty { width: 18mm; } col.c-unit { width: 20mm; }
col.c-price { width: 19mm; } col.c-value { width: 23mm; }
thead { display: table-header-group; }
tr { break-inside: avoid; }

/* --- brand band: page one only ------------------------------------------- */
/* Deliberately OUTSIDE the table. display:table-header-group repeats the whole thead on every
   page, which is what the column heads want and what the logo and the investment name emphatically
   do not — an offer states its title once. */
.brand-bar { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 13px;
             padding-bottom: 12px; border-bottom: 1px solid #18181b; }
.brand-bar img { height: 42px; width: auto; }
.brand-text { margin-left: auto; text-align: right; }
.brand-kind { font-size: 6.5pt; letter-spacing: .18em; text-transform: uppercase;
              color: #a1a1aa; margin-bottom: 3px; }
.brand-title { font-size: 12pt; font-weight: 600; letter-spacing: -.01em; line-height: 1.15; }

/* --- column heads: micro-type, hierarchy by weight and colour ------------- */
th { font-size: 6.5pt; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
     color: #a1a1aa; text-align: left; padding: 7px 4px; border-bottom: 1px solid #e4e4e7;
     border-right: 1px solid #f4f4f5; background: #fff; vertical-align: top; }

td { padding: 5px 8px; vertical-align: middle; border-bottom: 1px solid #f4f4f5;
     border-right: 1px solid #f4f4f5; }
td:first-child { padding-left: 0; }
/* No rule on the outer edges: a line at the sheet margin reads as a frame, not as a column. */
td:last-child, th:last-child { padding-right: 0; border-right: none; }
th:first-child { padding-left: 0; }
.num { text-align: right; white-space: nowrap; padding-left: 5px; padding-right: 5px; }
th.num { padding-left: 4px; padding-right: 4px; white-space: normal; }
/* A real border, not an inset shadow: a shadow is clipped to the padding box, so the row hairline
   notches it and the rail prints as dashes. Its own hairline is a background rather than a border,
   because a bottom border mitres with the left one at 45° and cuts a grey wedge into the colour. */
td.rail { border-left: 2px solid; padding-left: 11px;
          border-bottom: none; background-clip: padding-box;
          background-image: linear-gradient(#f4f4f5, #f4f4f5);
          background-repeat: no-repeat; background-position: 0 100%; background-size: 100% 1px; }
.desc { white-space: pre-line; overflow-wrap: break-word; color: #27272a; }
.unit { white-space: nowrap; text-align: right; color: #a1a1aa; font-size: 7pt;
        padding-left: 4px; padding-right: 5px; }
.price { color: #71717a; }
.value { font-weight: 500; }

/* --- sections ------------------------------------------------------------ */
/* The rail carries the section's hue down its rows, so the offer stays navigable once the band that
   named the section is a page back. A chip plus a 10% wash, not the sheet's full pastel fill: across
   150 rows a saturated block reads as highlighting rather than as structure. */
/* The rule stays on a div rather than on the td: a cell's border is drawn in the table's box model
   and the rail below it is not, so the two never line up. The cell keeps only the gap above the
   section, which has to fall outside the coloured rule. */
tr.band td { border: none; padding: 18px 0 0; break-after: avoid; }
thead + tbody > tr.band:first-child td { padding-top: 8px; }
tr.band + tr td { break-before: avoid; }
.band-inner { display: flex; align-items: center; gap: 9px;
              border-bottom: 2px solid; padding: 6px 0; }
.band-chip { width: 9px; height: 9px; border-radius: 2px; flex: none; }
.band-name { font-weight: 700; font-size: 9pt; letter-spacing: -.01em; }

tr.band-total td { border-bottom: none; border-right: none; border-top: 1px solid #f4f4f5;
                   padding-top: 6px; padding-bottom: 5px; color: #3f3f46; font-size: 7.5pt;
                   font-weight: 700; }
tr.band-total td.num { color: #18181b; }
/* The same painted hairline as every other rail cell, moved to the top edge — as a border it would
   mitre with the rail and cut a grey wedge out of the colour. */
tr.band-total td.rail { border-top: none; background-position: 0 0; }

/* --- totals: a rule and alignment, not a box ----------------------------- */
.totals { margin-top: 32px; break-inside: avoid; display: flex; justify-content: flex-end; }
.totals table { width: auto; min-width: 62mm; }
.totals td { border: none; padding: 6px 0 6px 28px; }
.totals .label { text-align: left; color: #71717a; }
.totals .value { text-align: right; white-space: nowrap; font-weight: 500; }
.totals tr.grand td { border-top: 1px solid #18181b; padding-top: 9px; font-size: 11pt;
                      font-weight: 600; letter-spacing: -.01em; color: #18181b; }
`

export type OfferColumnT = {
  key: string
  label: string
  colClass: string
  cellClass: string
  headerClass: string
  cell: (row: KosztorysV2RowT, view: PriceViewT, stages: KosztorysStageT[]) => string
}

// The offer is priced for the client and nothing else. Passed to every `cell` from here rather than
// written into each one: a plane repeated per column can be changed in four of five places, and the
// fifth would print one crew's stawka on a client's offer.
const OFFER_PRICE_VIEW: PriceViewT = 'client'

// Keyed by the same column keys the client-view settings hide, so „odznacz Cena j.m." in the dialog
// takes the column out of the printed offer too. The offer never prints the whole allowlist — the
// stage columns are a settlement document, not an offer — so the printed set is this list minus
// whatever the owner hid, minus whatever the ceiling below bars outright.
const OFFER_COLUMNS: readonly OfferColumnT[] = [
  {
    key: 'description',
    label: 'Opis prac',
    colClass: '',
    cellClass: 'desc',
    headerClass: '',
    cell: (row) => escapeHtml(row.description ?? ''),
  },
  {
    key: 'plannedQty',
    label: 'Przedmiar',
    colClass: 'c-qty',
    cellClass: 'num',
    headerClass: 'num',
    cell: (row) => escapeHtml(formatQty(row.plannedQty)),
  },
  {
    key: 'unit',
    label: 'Jednostka miary',
    colClass: 'c-unit',
    cellClass: 'unit',
    headerClass: 'num',
    cell: (row) => escapeHtml(row.unit ?? ''),
  },
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
    // „Pozostało" is part of the offer variant the dialog offers, so an owner who leaves it ticked
    // sees it in the podgląd — and used to lose it on paper.
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
<style>${STYLES}</style>
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
