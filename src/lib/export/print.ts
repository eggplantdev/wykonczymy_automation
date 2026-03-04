import { TRANSFER_EXPORT_COLUMNS } from '@/lib/export/transfer-columns'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { HeaderFieldT } from '@/types/export'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildPrintHtml(
  rows: TransferRowT[],
  visibleColumnIds: string[],
  headerFields: HeaderFieldT[],
): string {
  const columns = visibleColumnIds
    .filter((id) => TRANSFER_EXPORT_COLUMNS[id])
    .map((id) => ({ id, ...TRANSFER_EXPORT_COLUMNS[id]! }))

  const headerHtml =
    headerFields.length > 0
      ? `<div class="fields">${headerFields
          .map(
            (f) =>
              `<div><span class="label">${escapeHtml(f.label)}: </span><span class="value">${escapeHtml(f.value)}</span></div>`,
          )
          .join('')}</div>`
      : ''

  const theadHtml = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')

  const tbodyHtml = rows
    .map(
      (row) =>
        `<tr${row.cancelled ? ' class="cancelled"' : ''}>${columns
          .map((c) => `<td>${escapeHtml(c.getValue(row))}</td>`)
          .join('')}</tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<style>
@page { margin: 10mm; }
body { font-family: system-ui, -apple-system, sans-serif; font-size: 11px; margin: 0; padding: 16px; }
.fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 16px; margin-bottom: 16px; font-size: 12px; }
.label { color: #666; }
.value { font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-weight: 600; padding: 4px 6px; border-bottom: 2px solid #333; font-size: 11px; }
td { padding: 3px 6px; border-bottom: 1px solid #e5e5e5; }
tr:last-child td { border-bottom: none; }
.cancelled { text-decoration: line-through; opacity: 0.5; }
</style>
</head>
<body>${headerHtml}<table><thead><tr>${theadHtml}</tr></thead><tbody>${tbodyHtml}</tbody></table></body>
</html>`
}
