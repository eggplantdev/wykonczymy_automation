import type { Column } from '@tanstack/react-table'

export function columnLabel<TData>(column: Column<TData, unknown>): string {
  return (
    column.columnDef.meta?.label ??
    (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id)
  )
}
