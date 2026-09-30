'use client'

import React from 'react'
import { type HeaderGroup, type Row } from '@tanstack/react-table'
import { type useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils/cn'
import { DataTableRow } from './data-table-row'
import { TableHeader } from './table-header'
import { TableFooter } from './table-footer'
import { EmptyRow } from './empty-row'

type VirtualizedTableBodyPropsT<TData> = {
  parentRef: React.RefObject<HTMLDivElement | null>
  containerHeight: number
  /** Sizes the scroll container instead of `containerHeight` — for a list whose height follows its
   * layout, e.g. a `max-h-*` that lets a short list collapse. */
  containerClassName?: string
  headerGroups: HeaderGroup<TData>[]
  rows: Row<TData>[]
  virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>
  visibleColumnIdList: string[]
  getRowHref?: (row: TData) => string | undefined
  getRowClassName?: (row: TData) => string
  footer?: (visibleColumnIds: string[]) => React.ReactNode
}

export function VirtualizedTableBody<TData>({
  parentRef,
  containerHeight,
  containerClassName,
  headerGroups,
  rows,
  virtualizer,
  visibleColumnIdList,
  getRowHref,
  getRowClassName,
  footer,
}: VirtualizedTableBodyPropsT<TData>) {
  const virtualItems = virtualizer.getVirtualItems()
  const colCount = visibleColumnIdList.length
  // `table-auto` sizes columns from whatever rows the virtualizer currently renders, so columns
  // resize mid-scroll — a colgroup + fixed layout pins them to the column defs' sizes instead.
  const leafHeaders = headerGroups.at(-1)?.headers ?? []
  const totalWidth = leafHeaders.reduce((sum, header) => sum + header.getSize(), 0)

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', containerClassName)}
      style={containerClassName ? undefined : { height: containerHeight }}
    >
      <table className="w-full table-fixed text-sm" style={{ minWidth: totalWidth }}>
        <colgroup>
          {leafHeaders.map((header) => (
            <col
              key={header.id}
              style={{
                width: header.column.columnDef.meta?.fill ? undefined : header.getSize(),
              }}
            />
          ))}
        </colgroup>
        <TableHeader headerGroups={headerGroups} />
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={colCount} />
          ) : (
            <>
              {virtualItems.length > 0 && (
                <tr>
                  <td style={{ height: virtualItems[0]?.start ?? 0 }} colSpan={colCount} />
                </tr>
              )}

              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index]!
                return (
                  <DataTableRow
                    key={row.id}
                    row={row}
                    cells={row.getVisibleCells()}
                    measureRef={virtualizer.measureElement}
                    index={virtualRow.index}
                    getRowHref={getRowHref}
                    getRowClassName={getRowClassName}
                  />
                )
              })}

              {virtualItems.length > 0 && (
                <tr>
                  <td
                    style={{
                      height: virtualizer.getTotalSize() - (virtualItems.at(-1)?.end ?? 0),
                    }}
                    colSpan={colCount}
                  />
                </tr>
              )}
            </>
          )}
        </tbody>
        {footer && rows.length > 0 && <TableFooter>{footer(visibleColumnIdList)}</TableFooter>}
      </table>
    </div>
  )
}
