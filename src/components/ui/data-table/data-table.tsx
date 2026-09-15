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

// One object rather than a positional list: the toolbar needs the rank writers as well as the
// table, and every widening of that set would otherwise re-touch all eight call sites.
export type DataTableToolbarContextT<TData> = {
  table: Table<TData>
  columnVisibility: VisibilityState
  ranks: ColumnRanksT
  // Read off the DECLARED column list, never the ordered one: a rank is a midpoint between its new
  // neighbours' ranks, and an unranked neighbour falls back to its base. Derive these from the
  // already-permuted list and the second drop computes its midpoint against neighbours that have
  // already moved, landing one slot off. Same rule as the kosztorys grid's `assembleBaseRanks`.
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
  /** Controlled sort. Pass it together with `onSortingChange` and the table stops sorting rows
   * itself (`manualSorting`) — the caller is expected to fetch them already ordered. Either prop
   * alone leaves the table on its own local, client-side sort. */
  sorting?: SortingState
  onSortingChange?: (next: SortingState) => void
  /** Makes the row clickable — navigates to the returned URL */
  getRowHref?: (row: TData) => string | undefined
  /** Row click handler for a row that must not be an href — see `DataTableRow`. */
  onRowClick?: (row: TData) => void
  getRowClassName?: (row: TData) => string
  /** Summary `<tr>` pinned below the rows. Gets the visible column ids, in render order, so it can
   * span them or place a total under the column it belongs to even when some are hidden. */
  footer?: (visibleColumnIds: string[]) => React.ReactNode
  toolbar?: (ctx: DataTableToolbarContextT<TData>) => React.ReactNode
  /** A row count, a hint about what the filters did. Its own row rather than another toolbar item so
   * it reads as a statement about the list below it. */
  belowToolbar?: React.ReactNode
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
  belowToolbar,
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
    // Shift-click multi-sort is an affordance the controlled contract can't honour: the sort round
    // trips through a single URL parameter, so a second key would vanish on the next render.
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
  const visibleColumnIdList = visibleLeafColumns.map((column) => column.id)
  // Part of every row's key. React Compiler caches a <DataTableRow> whose props are unchanged, and a
  // hiding/reordering toggle changes neither `row` nor the callbacks — so without this the body keeps
  // rendering the cells it rendered before while the header drops them, and every remaining figure
  // lands under its neighbour's heading.
  const visibleColumnKey = visibleColumnIdList.join('_')

  return (
    <div className={cn('space-y-2', className)}>
      {toolbar && (
        <div className="flex items-center gap-2">
          {toolbar({
            table,
            columnVisibility,
            ranks,
            baseRanks: baseRanksFromKeys(declaredColumnIds),
            setRank,
            resetOrder,
          })}
        </div>
      )}
      {belowToolbar}
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
