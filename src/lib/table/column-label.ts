import type { Column } from '@tanstack/react-table'

/** The column-toggle menu and the print document must agree, so the fallback chain lives here. */
export function columnLabel<TData>(column: Column<TData, unknown>): string {
  return (
    column.columnDef.meta?.label ??
    (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id)
  )
}
