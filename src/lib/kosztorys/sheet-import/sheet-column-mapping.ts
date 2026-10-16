import { isColumnField, type ColumnFieldT } from './columns'
import { LAST_COLUMN_INDEX } from './read-sheet'

export type SheetColumnMappingT = Partial<Record<ColumnFieldT, number>>

// A column we would never fetch cannot be pointed at, whatever the browser sends.
export const isPointableColumn = (column: unknown): column is number =>
  typeof column === 'number' &&
  Number.isInteger(column) &&
  column >= 0 &&
  column <= LAST_COLUMN_INDEX

// Entries that aren't a field paired with a fetchable column index are dropped — a stale pointing is
// not a reason to refuse the import.
export function parseSheetColumnMapping(value: unknown): SheetColumnMappingT {
  if (typeof value !== 'object' || value === null) return {}

  const mapping: SheetColumnMappingT = {}
  for (const [field, column] of Object.entries(value)) {
    if (!isColumnField(field) || !isPointableColumn(column)) continue
    mapping[field] = column
  }
  return mapping
}
