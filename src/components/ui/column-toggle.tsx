'use client'

import { type Table, type VisibilityState } from '@tanstack/react-table'
import { ColumnToggleMenu, type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'

// TanStack adapter over <ColumnToggleMenu>: flattens a table instance into the menu's item list.
// The presentation lives in the menu — keep this file to the mapping.

type ColumnTogglePropsT<TData> = {
  table: Table<TData>
  columnVisibility: VisibilityState
}

export function ColumnToggle<TData>({ table, columnVisibility }: ColumnTogglePropsT<TData>) {
  const items: ColumnToggleItemT[] = table
    .getAllColumns()
    .filter((col) => col.getCanHide() && col.columnDef.meta?.canHide !== false)
    .map((col) => ({
      id: col.id,
      label:
        col.columnDef.meta?.label ??
        (typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id),
      visible: columnVisibility[col.id] !== false,
    }))

  return (
    <ColumnToggleMenu items={items} onToggle={(id) => table.getColumn(id)?.toggleVisibility()} />
  )
}
