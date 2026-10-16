'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type Row,
  type SortingState,
  type Table,
  type VisibilityState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils/cn'
import { DataTableRow } from './data-table-row'
import { VirtualizedTableBody } from './virtualized-table-body'
import { TableHeader } from './table-header'
import { isTableTextSize, TABLE_TEXT_SIZE, type TableTextSizeT } from './table-text-size'
import { TableFooter } from './table-footer'
import { EmptyRow } from './empty-row'
import {
  readOrder,
  readTextSize,
  readVisibility,
  writeOrder,
  writeTextSize,
  writeVisibility,
} from '@/lib/table/column-prefs-storage'
import { baseRanksFromKeys, orderColumnKeys, type ColumnRanksT } from '@/lib/table/column-order'
import { leafColumnIds } from '@/lib/table/leaf-column-ids'

export type DataTableToolbarContextT<TData> = {
  table: Table<TData>
  columnVisibility: VisibilityState
  ranks: ColumnRanksT
  // Off the DECLARED list, not the ordered one, or a second drop's midpoint lands one slot off its
  // already-moved neighbours.
  baseRanks: ColumnRanksT
  setRank: (key: string, rank: number) => void
  resetOrder: () => void
  textSize: TableTextSizeT
  setTextSize: (size: TableTextSizeT) => void
}

type DataTablePropsT<TData> = {
  data: TData[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[]
  enableVirtualization?: boolean
  virtualRowHeight?: number
  virtualContainerHeight?: number
  virtualContainerClassName?: string
  storageKey?: string
  defaultColumnVisibility?: VisibilityState
  initialSorting?: SortingState
  /** Controlled sort — pass with `onSortingChange` and the caller is expected to fetch rows already
   * ordered (`manualSorting`). */
  sorting?: SortingState
  onSortingChange?: (next: SortingState) => void
  getRowHref?: (row: TData) => string | undefined
  getRowClassName?: (row: TData) => string
  footer?: (visibleColumnIds: string[]) => React.ReactNode
  toolbar?: (ctx: DataTableToolbarContextT<TData>) => React.ReactNode
  aboveToolbar?: React.ReactNode
  belowToolbar?: React.ReactNode
  renderRows?: (rows: Row<TData>[], visibleColumnIds: string[]) => React.ReactNode
  defaultTextSize?: TableTextSizeT
  className?: string
}

export function DataTable<TData>({
  data,
  columns,
  enableVirtualization = false,
  virtualRowHeight = 44,
  virtualContainerHeight = 600,
  virtualContainerClassName,
  storageKey,
  defaultColumnVisibility = {},
  initialSorting = [],
  sorting: controlledSorting,
  onSortingChange,
  getRowHref,
  getRowClassName,
  footer,
  toolbar,
  aboveToolbar,
  belowToolbar,
  renderRows,
  defaultTextSize = 'sm',
  className,
}: DataTablePropsT<TData>) {
  const [localSorting, setLocalSorting] = useState<SortingState>(initialSorting)
  const isManualSorting = controlledSorting !== undefined && onSortingChange !== undefined
  const sorting = isManualSorting ? controlledSorting : localSorting
  const [storedVisibility, setStoredVisibility] = useState<VisibilityState>({})
  const columnVisibility = { ...defaultColumnVisibility, ...storedVisibility }
  const [ranks, setRanks] = useState<ColumnRanksT>({})
  const [storedTextSize, setStoredTextSize] = useState<TableTextSizeT>()
  const textSize = storedTextSize ?? defaultTextSize

  // Apply persisted visibility and order after hydration to avoid server/client mismatch
  useEffect(() => {
    if (!storageKey) return
    setStoredVisibility(readVisibility(storageKey))
    setRanks(readOrder(storageKey))
    const storedSize = readTextSize(storageKey)
    if (isTableTextSize(storedSize)) setStoredTextSize(storedSize)
  }, [storageKey])

  function setTextSize(size: TableTextSizeT) {
    setStoredTextSize(size)
    if (storageKey) writeTextSize(storageKey, size)
  }

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

  // A column that cannot be hidden (the row's select box) is also left off the reorder list, so it is
  // pinned in front instead of ranked — otherwise a dragged column could rank past it.
  const pinnedColumnIds = leafColumnIds(columns.filter((column) => column.enableHiding === false))
  const rankedColumnIds = leafColumnIds(columns.filter((column) => column.enableHiding !== false))

  const table = useReactTable({
    data: data as TData[],
    columns,
    state: {
      sorting,
      columnVisibility,
      // A new array every render, and that is load-bearing: TableHeader's sort arrow and
      // VirtualizedTableBody's virtual items are compiled children holding TanStack's mutable objects,
      // re-read only because this renews `headerGroups` and every row's cells.
      columnOrder: [...pinnedColumnIds, ...orderColumnKeys(rankedColumnIds, ranks)],
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
    // Functional, so two toggles in one tick each build on the other instead of on the render's copy.
    onColumnVisibilityChange: (updater) =>
      setStoredVisibility((stored) => {
        const current = { ...defaultColumnVisibility, ...stored }
        const next = typeof updater === 'function' ? updater(current) : updater
        // A stored default would pin today's default for this viewer even after the default changes.
        const deviations = Object.fromEntries(
          Object.entries(next).filter(
            ([id, visible]) => visible !== (defaultColumnVisibility[id] ?? true),
          ),
        )
        if (storageKey) writeVisibility(storageKey, deviations)
        return deviations
      }),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const { rows } = table.getRowModel()

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => virtualRowHeight,
    // Keyed by the row, not by its index: the measurement cache outlives a search or a sort, so without
    // this the heights measured for positions 0..n are reused for whatever rows land there next and
    // `getTotalSize()` plus the top spacer describe a list that is no longer on screen.
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan: 10,
    enabled: enableVirtualization,
  })

  const headerGroups = table.getHeaderGroups()
  const visibleLeafColumns = table.getVisibleLeafColumns()
  const visibleColCount = visibleLeafColumns.length
  const visibleColumnIdList = visibleLeafColumns.map((column) => column.id)

  return (
    <div className={cn('space-y-2 max-sm:space-y-6', className)}>
      {aboveToolbar && <div className="max-sm:-mt-4">{aboveToolbar}</div>}
      {toolbar?.({
        table,
        columnVisibility,
        ranks,
        baseRanks: baseRanksFromKeys(rankedColumnIds),
        setRank,
        resetOrder,
        textSize,
        setTextSize,
      })}
      {belowToolbar}
      {renderRows ? (
        renderRows(rows, visibleColumnIdList)
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          {enableVirtualization ? (
            <VirtualizedTableBody
              parentRef={parentRef}
              containerHeight={virtualContainerHeight}
              containerClassName={virtualContainerClassName}
              headerGroups={headerGroups}
              rows={rows}
              virtualizer={virtualizer}
              visibleColumnIdList={visibleColumnIdList}
              getRowHref={getRowHref}
              getRowClassName={getRowClassName}
              footer={footer}
              textSize={textSize}
            />
          ) : (
            <table className={cn('w-full', TABLE_TEXT_SIZE[textSize].body)}>
              {visibleLeafColumns.some((column) => column.columnDef.meta?.fill) && (
                <colgroup>
                  {visibleLeafColumns.map((column) => (
                    <col
                      key={column.id}
                      className={column.columnDef.meta?.fill ? 'w-full' : undefined}
                    />
                  ))}
                </colgroup>
              )}
              <TableHeader headerGroups={headerGroups} textSize={textSize} />
              <tbody>
                {rows.length === 0 ? (
                  <EmptyRow colSpan={visibleColCount} />
                ) : (
                  rows.map((row) => (
                    <DataTableRow
                      key={row.id}
                      row={row}
                      cells={row.getVisibleCells()}
                      getRowHref={getRowHref}
                      getRowClassName={getRowClassName}
                    />
                  ))
                )}
              </tbody>
              {footer && rows.length > 0 && (
                <TableFooter>{footer(visibleColumnIdList)}</TableFooter>
              )}
            </table>
          )}
        </div>
      )}
    </div>
  )
}
