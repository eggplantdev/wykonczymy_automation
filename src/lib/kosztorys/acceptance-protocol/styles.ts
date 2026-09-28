export const PROTOCOL_PRINT_STYLES = `
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* Same split as the offer: the dialog's „Marginesy" can drop @page, so the horizontal inset lives on
   the body; the empty margin boxes suppress the browser's own header and footer. */
@page {
  margin: 14mm 0 12mm;
  @top-center { content: ''; }
  @bottom-center { content: ''; }
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 9.5pt; line-height: 1.45; color: #18181b; margin: 0; padding: 4mm 18mm;
  font-variant-numeric: tabular-nums;
}

.head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.head img { height: 38px; width: auto; }
.place-date { width: 70mm; text-align: center; }
.place-date .fill { display: block; min-width: 0; }
.caption { font-size: 7pt; color: #71717a; }
h1 { text-align: center; font-size: 15pt; letter-spacing: .02em; margin: 14px 0 12px; }
h2 { font-size: 10pt; margin: 16px 0 6px; break-after: avoid; }
h3 { font-size: 10pt; font-style: italic; margin: 10px 0 2px; }
p { margin: 0 0 4px; }

.line { display: flex; align-items: baseline; gap: 6px; margin: 5px 0; }
.line .fill { flex: 1; }
.pair { display: flex; gap: 24px; }
.pair > .line { flex: 1; }
/* A blank prints as a dotted line to write on; a filled field keeps the same line under its text. */
.fill { display: inline-block; min-width: 40mm; min-height: 1.3em; padding: 0 4px;
        border-bottom: 1px dotted #52525b; font-weight: 600; }
.blank-line { border-bottom: 1px dotted #52525b; height: 1.9em; }

.boxes { list-style: none; padding: 0; margin: 2px 0 4px; }
.boxes li { display: flex; gap: 8px; align-items: baseline; margin: 2px 0; }
.box { flex: none; display: inline-flex; align-items: center; justify-content: center;
       width: 10px; height: 10px; border: 1px solid #18181b; font-size: 8pt; line-height: 1;
       position: relative; top: 1px; }

table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td { border: 1px solid #18181b; padding: 4px 6px; text-align: left; vertical-align: top; }
th { font-size: 8.5pt; }
td { height: 2em; }
col.c-lp { width: 11mm; } col.c-qty { width: 30mm; } col.c-check { width: 34mm; }
col.c-severity { width: 34mm; } col.c-deadline { width: 30mm; }
.section-name { color: #71717a; }
.num { text-align: right; white-space: nowrap; }

.settlement { width: auto; min-width: 100mm; margin: 2px 0 8px; }
.settlement td { border: none; border-bottom: 1px solid #e4e4e7; height: auto; padding: 4px 0; }
.settlement td.num { padding-left: 28px; }
.settlement tr.total td { font-weight: 700; border-bottom: none; border-top: 1px solid #18181b; }
.settlement tr.subtotal td { font-weight: 600; }

.note { font-style: italic; font-size: 8.5pt; margin-top: 6px; }
.closing { margin-top: 16px; break-inside: avoid; }
.signatures { display: flex; gap: 20mm; margin-top: 22mm; break-inside: avoid; }
.signatures div { flex: 1; border-top: 1px dotted #52525b; padding-top: 4px; text-align: center;
                  font-weight: 700; }
`
