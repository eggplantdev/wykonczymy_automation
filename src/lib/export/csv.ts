import { escapeCsv } from '@/lib/export/csv-cell'
import { TRANSFER_EXPORT_COLUMNS } from '@/lib/export/transfer-columns'
import type { TransferRowT } from '@/lib/tables/transfers'

/** Generates a CSV string from transfer rows using only visible column IDs. */
export function buildTransferCsv(rows: TransferRowT[], visibleColumnIds: string[]): string {
  const columns = visibleColumnIds
    .filter((id) => TRANSFER_EXPORT_COLUMNS[id])
    .map((id) => ({ id, ...TRANSFER_EXPORT_COLUMNS[id]! }))

  const header = columns.map((c) => escapeCsv(c.label)).join(',')
  const dataRows = rows.map((row) => columns.map((c) => escapeCsv(c.getValue(row))).join(','))

  return [header, ...dataRows].join('\n')
}
