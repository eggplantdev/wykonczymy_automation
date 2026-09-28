export const OFFER_PRINT_STYLES = `
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

.totals { margin-top: 32px; break-inside: avoid; display: flex; justify-content: flex-end; }
.totals table { width: auto; min-width: 62mm; }
.totals td { border: none; padding: 6px 0 6px 28px; }
.totals .label { text-align: left; color: #71717a; }
.totals .value { text-align: right; white-space: nowrap; font-weight: 500; }
.totals tr.grand td { border-top: 1px solid #18181b; padding-top: 9px; font-size: 11pt;
                      font-weight: 600; letter-spacing: -.01em; color: #18181b; }
`
