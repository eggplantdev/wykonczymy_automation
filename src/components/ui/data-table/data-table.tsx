'use client'

import React, { useState, useEffect, useRef } from 'react'
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
  data: readonly TData[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[]
  enableVirtualization?: boolean
  virtualRowHeight?: number
  virtualContainerHeight?: number
  /** localStorage key for persisting column visibility */
  storageKey?: string
  /** Sort applied on first render. Defaults to none. */
  initialSorting?: SortingState
  /** Makes the row clickable — navigates to the returned URL */
  getRowHref?: (row: TData) => string | undefined
  getRowClassName?: (row: TData) => string
  toolbar?: (
    table: Table<TData>,
    columnVisibility: VisibilityState,
    sorting: SortingState,
  ) => React.ReactNode
  className?: string
}

export function DataTable<TData>({
  data,
  columns,
  enableVirtualization = false,
  virtualRowHeight = 44,
  virtualContainerHeight = 600,
  storageKey,
  initialSorting = [],
  getRowHref,
  getRowClassName,
  toolbar,
  className,
}: DataTablePropsT<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  // Apply persisted visibility after hydration to avoid server/client mismatch
  useEffect(() => {
    if (storageKey) setColumnVisibility(readVisibility(storageKey))
  }, [storageKey])

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
  const visibleLeafColumns = table.getVisibleLeafColumns()
  const visibleColCount = visibleLeafColumns.length
  const visibleColumnIds = new Set(visibleLeafColumns.map((col) => col.id))

  return (
    <div className={cn('space-y-2', className)}>
      {toolbar && (
        <div className="flex items-center gap-2">{toolbar(table, columnVisibility, sorting)}</div>
      )}
      <div className="border-border overflow-x-auto rounded-lg border">
        {enableVirtualization ? (
          <VirtualizedTableBody
            parentRef={parentRef}
            containerHeight={virtualContainerHeight}
            headerGroups={headerGroups}
            rows={rows}
            virtualizer={virtualizer}
            colCount={visibleColCount}
            visibleColumnIds={visibleColumnIds}
            getRowHref={getRowHref}
            getRowClassName={getRowClassName}
          />
        ) : (
          <table className="w-full text-sm">
            <TableHeader headerGroups={headerGroups} />
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={visibleColCount} />
              ) : (
                rows.map((row) => (
                  <DataTableRow
                    key={row.id}
                    row={row}
                    visibleColumnIds={visibleColumnIds}
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
