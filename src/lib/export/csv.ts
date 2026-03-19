import { TRANSFER_EXPORT_COLUMNS, EXPORT_EXCLUDED_COLUMNS } from '@/lib/export/transfer-columns'
import type { TransferRowT } from '@/lib/tables/transfers'

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Generates a CSV string from transfer rows using only visible column IDs. */
export function buildTransferCsv(rows: TransferRowT[], visibleColumnIds: string[]): string {
  const columns = visibleColumnIds
    .filter((id) => !EXPORT_EXCLUDED_COLUMNS.has(id) && TRANSFER_EXPORT_COLUMNS[id])
    .map((id) => ({ id, ...TRANSFER_EXPORT_COLUMNS[id]! }))

  const header = columns.map((c) => escapeCsv(c.label)).join(',')
  const dataRows = rows.map((row) => columns.map((c) => escapeCsv(c.getValue(row))).join(','))

  return [header, ...dataRows].join('\n')
}
