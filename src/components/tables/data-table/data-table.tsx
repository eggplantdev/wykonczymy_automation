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
import { cn } from '@/lib/utils/cn'
import { DataTableRow } from './data-table-row'
import { VirtualizedTableBody } from './virtualized-table-body'
import { TableHeader } from './table-header'
import { TableFooter } from './table-footer'
import { EmptyRow } from './empty-row'
import {
  readOrder,
  readVisibility,
  writeOrder,
  writeVisibility,
} from '@/lib/table/column-prefs-storage'
import { baseRanksFromKeys, orderColumnKeys, type ColumnRanksT } from '@/lib/table/column-order'
import { leafColumnIds } from '@/lib/table/leaf-column-ids'

// One object, not a positional list: the toolbar needs the rank writers too, and widening a
// positional list would re-touch all eight call sites.
export type DataTableToolbarContextT<TData> = {
  table: Table<TData>
  columnVisibility: VisibilityState
  ranks: ColumnRanksT
  // Off the DECLARED list, not the ordered one, or a second drop's midpoint lands one slot off its
  // already-moved neighbours. Same rule as the kosztorys grid's `assembleBaseRanks`.
  baseRanks: ColumnRanksT
  setRank: (key: string, rank: number) => void
  resetOrder: () => void
}

type DataTablePropsT<TData> = {
  data: TData[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[]
  enableVirtualization?: boolean
  virtualRowHeight?: number
  virtualContainerHeight?: number
  /** localStorage key for persisting column visibility */
  storageKey?: string
  /** Sort applied on first render. Defaults to none. Ignored when `sorting` is controlled. */
  initialSorting?: SortingState
  /** Controlled sort — pass with `onSortingChange` and the caller is expected to fetch rows already
   * ordered (`manualSorting`). Either prop alone leaves the table on its own local sort. */
  sorting?: SortingState
  onSortingChange?: (next: SortingState) => void
  /** Makes the row clickable — navigates to the returned URL */
  getRowHref?: (row: TData) => string | undefined
  /** Row click handler for a row that must not be an href — see `DataTableRow`. */
  onRowClick?: (row: TData) => void
  getRowClassName?: (row: TData) => string
  /** Summary `<tr>` pinned below the rows. Gets visible column ids in render order, so it can span
   * them or place a total under its column even when others are hidden. */
  footer?: (visibleColumnIds: string[]) => React.ReactNode
  toolbar?: (ctx: DataTableToolbarContextT<TData>) => React.ReactNode
  /** A row count, a hint about what the filters did — its own row so it reads as a statement about
   * the list below rather than another toolbar item. */
  aboveToolbar?: React.ReactNode
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
  sorting: controlledSorting,
  onSortingChange,
  getRowHref,
  onRowClick,
  getRowClassName,
  footer,
  toolbar,
  aboveToolbar,
  className,
}: DataTablePropsT<TData>) {
  const [localSorting, setLocalSorting] = useState<SortingState>(initialSorting)
  const isManualSorting = controlledSorting !== undefined && onSortingChange !== undefined
  const sorting = isManualSorting ? controlledSorting : localSorting
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [ranks, setRanks] = useState<ColumnRanksT>({})

  // Apply persisted visibility and order after hydration to avoid server/client mismatch
  useEffect(() => {
    if (!storageKey) return
    setColumnVisibility(readVisibility(storageKey))
    setRanks(readOrder(storageKey))
  }, [storageKey])

  function persistRanks(next: ColumnRanksT) {
    setRanks(next)
    if (storageKey) writeOrder(storageKey, next)
  }

  function setRank(key: string, rank: number) {
    persistRanks({ ...ranks, [key]: rank })
  }

  function resetOrder() {
    persistRanks({})
  }

  const declaredColumnIds = leafColumnIds(columns)

  const table = useReactTable({
    data: data as TData[],
    columns,
    state: {
      sorting,
      columnVisibility,
      columnOrder: orderColumnKeys(declaredColumnIds, ranks),
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      if (isManualSorting) onSortingChange(next)
      else setLocalSorting(next)
    },
    manualSorting: isManualSorting,
    // Multi-sort can't survive a controlled sort: it round-trips through one URL parameter, so a
    // second key would vanish on the next render.
    enableMultiSort: !isManualSorting,
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
  const visibleColumnIdList = visibleLeafColumns.map((column) => column.id)
  // Part of every row's key: a hide/reorder toggle changes neither `row` nor the callbacks, so React
  // Compiler would keep the cached <DataTableRow> rendering stale cells under the new header.
  const visibleColumnKey = visibleColumnIdList.join('_')

  return (
    /* 24px below `sm` to match `PageWrapper`'s `gap-6` — the stock 8px left the table looking welded
       to the toolbar's last wrapped row. */
    <div className={cn('space-y-2 max-sm:space-y-6', className)}>
      {/* Pulled back against the stack's 24px so it reads as part of the page heading, not the
          toolbar's first row. Can't live in `PageWrapper`'s <h1> — it counts client-side filters. */}
      {aboveToolbar && <div className="max-sm:-mt-4">{aboveToolbar}</div>}
      {toolbar?.({
        table,
        columnVisibility,
        ranks,
        baseRanks: baseRanksFromKeys(declaredColumnIds),
        setRank,
        resetOrder,
      })}
      <div className="border-border overflow-x-auto rounded-lg border">
        {enableVirtualization ? (
          <VirtualizedTableBody
            parentRef={parentRef}
            containerHeight={virtualContainerHeight}
            headerGroups={headerGroups}
            rows={rows}
            virtualizer={virtualizer}
            visibleColumnIdList={visibleColumnIdList}
            getRowHref={getRowHref}
            onRowClick={onRowClick}
            getRowClassName={getRowClassName}
            footer={footer}
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
                    key={`${row.id}:${visibleColumnKey}`}
                    row={row}
                    getRowHref={getRowHref}
                    onRowClick={onRowClick}
                    getRowClassName={getRowClassName}
                  />
                ))
              )}
            </tbody>
            {footer && rows.length > 0 && <TableFooter>{footer(visibleColumnIdList)}</TableFooter>}
          </table>
        )}
      </div>
    </div>
  )
}
