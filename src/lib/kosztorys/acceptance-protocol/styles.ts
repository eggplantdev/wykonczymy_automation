import { PRINT_DOCUMENT_BASE_STYLES } from '@/lib/utils/print-document-styles'

export const PROTOCOL_PRINT_STYLES = `${PRINT_DOCUMENT_BASE_STYLES}
.head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.head img { height: 38px; width: auto; }
.place-date { width: 70mm; text-align: center; }
.place-date .fill { display: block; min-width: 0; }
h3 { font-size: 10pt; font-style: italic; margin: 10px 0 2px; }

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
col.c-lp { width: 11mm; } col.c-qty { width: 30mm; }
col.c-severity { width: 34mm; } col.c-deadline { width: 30mm; }
.num { text-align: right; white-space: nowrap; }

.settlement { width: auto; min-width: 100mm; margin: 2px 0 8px; }
.settlement td { border: none; border-bottom: 1px solid #e4e4e7; height: auto; padding: 4px 0; }
.settlement td.num { padding-left: 28px; }
.settlement tr.total td { font-weight: 700; border-bottom: none; border-top: 1px solid #18181b; }
.settlement tr.subtotal td { font-weight: 600; }

.note { font-style: italic; font-size: 8.5pt; margin-top: 6px; }
.closing { margin-top: 16px; break-inside: avoid; }
`
