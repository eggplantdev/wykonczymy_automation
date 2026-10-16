import type { ColumnDef } from '@tanstack/react-table'

// Reading the DEFS rather than the table is what makes this the declared order: the table's own leaf
// list comes back already permuted by `columnOrder`.
export function leafColumnIds<TData>(columns: ColumnDef<TData, unknown>[]): string[] {
  return columns.map(
    (column) => column.id ?? ('accessorKey' in column ? String(column.accessorKey) : ''),
  )
}
