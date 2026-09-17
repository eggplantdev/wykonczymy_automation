'use client'

import { useState } from 'react'
import { type Table, type VisibilityState } from '@tanstack/react-table'
import { ColumnToggleMenu, type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import { ColumnOrderDialog } from '@/components/ui/column-order-dialog'
import { type ColumnRanksT } from '@/lib/table/column-order'
import { columnLabel } from '@/lib/table/column-label'

// TanStack adapter over <ColumnToggleMenu>: flattens a table instance into the menu's item list.
// The presentation lives in the menu — keep this file to the mapping.

type ColumnTogglePropsT<TData> = {
  table: Table<TData>
  columnVisibility: VisibilityState
  ranks: ColumnRanksT
  baseRanks: ColumnRanksT
  setRank: (key: string, rank: number) => void
  resetOrder: () => void
}

export function ColumnToggle<TData>({
  table,
  columnVisibility,
  ranks,
  baseRanks,
  setRank,
  resetOrder,
}: ColumnTogglePropsT<TData>) {
  const [orderOpen, setOrderOpen] = useState(false)

  // getAllLeafColumns applies the table's columnOrder; getAllColumns would hand both surfaces the
  // declaration order, so the dialog would open showing the state before the last drag. The base
  // ranks are the other half of that pair and must come from the declared order — hence the prop.
  const columns = table.getAllLeafColumns()
  const items: ColumnToggleItemT[] = columns.map((col) => ({
    id: col.id,
    label: columnLabel(col),
    visible: columnVisibility[col.id] !== false,
  }))

  return (
    <>
      <ColumnToggleMenu
        items={items}
        onToggle={(id) => table.getColumn(id)?.toggleVisibility()}
        // Merged into current state, not TanStack's toggleAllColumnsVisible — that rebuilds the map
        // from {} and drops unknown ids, wiping a sibling page's preference (shared storageKey, different excludeColumns).
        onToggleAll={(visible) =>
          table.setColumnVisibility({
            ...columnVisibility,
            ...Object.fromEntries(columns.map((col) => [col.id, visible])),
          })
        }
        onOpenOrder={() => setOrderOpen(true)}
      />
      {/* Sibling of the menu, never inside its content — a dialog mounted there unmounts with the
          menu on close and loses the focus fight. */}
      <ColumnOrderDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        items={items}
        description="Przeciągnij pozycję, żeby przestawić kolumny w tej tabeli. Ustawienie zapamiętuje ta przeglądarka."
        ranks={ranks}
        baseRanks={baseRanks}
        onSetRank={setRank}
        onReset={resetOrder}
      />
    </>
  )
}
