'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/tables/data-table/data-table'
import type { ChangeRowT } from '@/lib/kosztorys/history/change-rows'

const CHANGE_COLUMNS: ColumnDef<ChangeRowT>[] = [
  {
    accessorKey: 'description',
    header: 'Praca',
    cell: ({ row }) => (
      <>
        {row.original.sectionName && (
          <span className="text-muted-foreground">{row.original.sectionName} · </span>
        )}
        {row.original.description}
      </>
    ),
  },
  { accessorKey: 'what', header: 'Co' },
  {
    accessorKey: 'before',
    header: 'Było',
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground tabular-nums line-through">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'after',
    header: 'Jest',
    enableSorting: false,
    cell: ({ getValue }) => <span className="font-medium tabular-nums">{getValue<string>()}</span>,
  },
]

export function HistoryChangesTable({ rows }: { rows: ChangeRowT[] }) {
  return <DataTable data={rows} columns={CHANGE_COLUMNS} className="w-full" />
}
