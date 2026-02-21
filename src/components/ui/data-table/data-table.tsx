'use client'

import React, { useState, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type Table,
  type VisibilityState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/cn'
import { DataTableRow } from './data-table-row'
import { VirtualizedTableBody } from './virtualized-table-body'
import { TableHeader } from './table-header'
import { EmptyRow, readVisibility, writeVisibility } from './table-helpers'

type DataTablePropsT<TData> = {
  readonly data: readonly TData[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly columns: ColumnDef<TData, any>[]
  readonly emptyMessage?: string
  readonly enableVirtualization?: boolean
  readonly virtualRowHeight?: number
  readonly virtualContainerHeight?: number
  /** localStorage key for persisting column visibility */
  readonly storageKey?: string
  /** Makes the row clickable — navigates to the returned URL */
  readonly getRowHref?: (row: TData) => string | undefined
  readonly getRowClassName?: (row: TData) => string
  readonly toolbar?: (table: Table<TData>) => React.ReactNode
  readonly className?: string
}

export function DataTable<TData>({
  data,
  columns,
  emptyMessage = 'Brak danych',
  enableVirtualization = false,
  virtualRowHeight = 44,
  virtualContainerHeight = 600,
  storageKey,
  getRowHref,
  getRowClassName,
  toolbar,
  className,
}: DataTablePropsT<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    storageKey ? readVisibility(storageKey) : {},
  )

  const table = useReactTable({
    data: data as TData[],
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (storageKey) writeVisibility(storageKey, next)
        return next
      })
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const { rows } = table.getRowModel()

  // Virtual scroll — only active when enableVirtualization is true
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => virtualRowHeight,
    overscan: 10,
    enabled: enableVirtualization,
  })

  const headerGroups = table.getHeaderGroups()

  return (
    <div className={cn('space-y-2', className)}>
      {toolbar && <div className="flex items-center">{toolbar(table)}</div>}
      <div className="border-border overflow-x-auto rounded-lg border">
        {enableVirtualization ? (
          <VirtualizedTableBody
            parentRef={parentRef}
            containerHeight={virtualContainerHeight}
            headerGroups={headerGroups}
            rows={rows}
            virtualizer={virtualizer}
            colCount={columns.length}
            emptyMessage={emptyMessage}
            getRowHref={getRowHref}
            getRowClassName={getRowClassName}
          />
        ) : (
          <table className="w-full text-sm">
            <TableHeader headerGroups={headerGroups} />
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={columns.length} message={emptyMessage} />
              ) : (
                rows.map((row) => (
                  <DataTableRow
                    key={row.id}
                    row={row}
                    getRowHref={getRowHref}
                    getRowClassName={getRowClassName}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
