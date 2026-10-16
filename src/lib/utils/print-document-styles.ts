export const PRINT_DOCUMENT_BASE_STYLES = `
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* The vertical margin has to live on @page: body padding does not repeat on continuation pages in
   Safari, which ignores box-decoration-break on a block fragmented across pages, so page two started
   its table at the sheet edge. The horizontal inset stays on the body, where the dialog's
   „Marginesy: Brak" cannot take it away. The empty margin boxes suppress the browser's own header
   and footer. */
@page {
  margin: 16mm 0 14mm;
  @top-center { content: ''; }
  @bottom-center { content: ''; }
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 9.5pt; line-height: 1.45; color: #18181b; margin: 0; padding: 0 18mm;
  font-variant-numeric: tabular-nums;
}

.caption { font-size: 7pt; color: #71717a; }
h1 { text-align: center; font-size: 15pt; letter-spacing: .02em; margin: 14px 0 12px; }
h2 { font-size: 10pt; margin: 16px 0 6px; break-after: avoid; }
p { margin: 0 0 4px; }

.line { display: flex; align-items: baseline; gap: 6px; margin: 5px 0; }
.line .fill { flex: 1; }
.fill { display: inline-block; min-width: 40mm; min-height: 1.3em; padding: 0 4px;
        border-bottom: 1px dotted #52525b; font-weight: 600; }
.blank-line { border-bottom: 1px dotted #52525b; height: 1.9em; }

.signatures { display: flex; gap: 20mm; margin-top: 22mm; break-inside: avoid; }
.signatures div { flex: 1; border-top: 1px dotted #52525b; padding-top: 4px; text-align: center;
                  font-weight: 700; }
`
