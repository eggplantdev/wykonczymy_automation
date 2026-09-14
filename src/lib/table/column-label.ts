import type { Column } from '@tanstack/react-table'

/**
 * The column's human label. Two surfaces need it — the column-toggle menu and the print document —
 * so the fallback chain lives here rather than being re-derived at each.
 */
export function columnLabel<TData>(column: Column<TData, unknown>): string {
  return (
    column.columnDef.meta?.label ??
    (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id)
  )
}
