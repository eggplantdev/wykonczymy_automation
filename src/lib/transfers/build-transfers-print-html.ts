import { escapeHtml } from '@/lib/utils/escape-html'
import type { TransferRowT } from '@/types/transfers'

export type PrintColumnT = {
  id: string
  label: string
  getValue: (row: TransferRowT) => string
}

// The print window has no stylesheet of its own — it is an about:blank document we hand a full
// HTML string, so the sheet ships inline. `pre-line` on the description mirrors the screen cell's
// `whitespace-pre-line`; without it a multi-line opis collapses onto one line.
const PRINT_STYLES = `
@page { margin: 10mm; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; margin: 0; padding: 16px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-weight: 600; padding: 4px 6px; border-bottom: 2px solid #333; }
td { padding: 3px 6px; border-bottom: 1px solid #e5e5e5; vertical-align: top; white-space: pre-line; }
tr:last-child td { border-bottom: none; }
`

/**
 * Turns the fetched rows and the columns the reader has on screen into a standalone print document.
 * Every value passes through `escapeHtml` — the opis is free text typed by a user.
 */
export function buildTransfersPrintHtml(
  rows: TransferRowT[],
  columns: PrintColumnT[],
  title: string,
): string {
  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')
  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map((column) => `<td>${escapeHtml(column.getValue(row))}</td>`).join('')}</tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body>
</html>`
}
