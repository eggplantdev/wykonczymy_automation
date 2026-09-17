'use client'

import React from 'react'
import { type HeaderGroup, type Row } from '@tanstack/react-table'
import { type useVirtualizer } from '@tanstack/react-virtual'
import { DataTableRow } from './data-table-row'
import { TableHeader } from './table-header'
import { TableFooter } from './table-footer'
import { EmptyRow } from './empty-row'

type VirtualizedTableBodyPropsT<TData> = {
  parentRef: React.RefObject<HTMLDivElement | null>
  containerHeight: number
  headerGroups: HeaderGroup<TData>[]
  rows: Row<TData>[]
  virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>
  visibleColumnIdList: string[]
  getRowHref?: (row: TData) => string | undefined
  /** Row click handler for a row that must not be an href — see `DataTableRow`. */
  onRowClick?: (row: TData) => void
  getRowClassName?: (row: TData) => string
  footer?: (visibleColumnIds: string[]) => React.ReactNode
}

export function VirtualizedTableBody<TData>({
  parentRef,
  containerHeight,
  headerGroups,
  rows,
  virtualizer,
  visibleColumnIdList,
  getRowHref,
  onRowClick,
  getRowClassName,
  footer,
}: VirtualizedTableBodyPropsT<TData>) {
  const virtualItems = virtualizer.getVirtualItems()
  const colCount = visibleColumnIdList.length
  const visibleColumnKey = visibleColumnIdList.join('_')
  // `table-auto` sizes columns from whatever rows the virtualizer currently renders, so columns
  // resize mid-scroll — a colgroup + fixed layout pins them to the column defs' sizes instead.
  const leafHeaders = headerGroups.at(-1)?.headers ?? []
  const totalWidth = leafHeaders.reduce((sum, header) => sum + header.getSize(), 0)

  return (
    <div ref={parentRef} style={{ height: containerHeight, overflow: 'auto' }}>
      <table className="w-full table-fixed text-sm" style={{ minWidth: totalWidth }}>
        <colgroup>
          {leafHeaders.map((header) => (
            <col key={header.id} style={{ width: header.getSize() }} />
          ))}
        </colgroup>
        <TableHeader headerGroups={headerGroups} />
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={colCount} />
          ) : (
            <>
              {/* Top spacer — pushes visible rows to correct scroll position */}
              {virtualItems.length > 0 && (
                <tr>
                  <td style={{ height: virtualItems[0]?.start ?? 0 }} colSpan={colCount} />
                </tr>
              )}

              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index]!
                return (
                  <DataTableRow
                    key={`${row.id}:${visibleColumnKey}`}
                    row={row}
                    getRowHref={getRowHref}
                    onRowClick={onRowClick}
                    getRowClassName={getRowClassName}
                  />
                )
              })}

              {/* Bottom spacer — maintains total scroll height */}
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
