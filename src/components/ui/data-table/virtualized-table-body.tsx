'use client'

// Renders only visible rows for large datasets.
// Spacer rows above/below simulate scroll height without rendering all DOM nodes.

import React from 'react'
import { type Row } from '@tanstack/react-table'
import { type useVirtualizer } from '@tanstack/react-virtual'
import { DataTableRow } from './data-table-row'
import { TableHeader } from './table-header'
import { EmptyRow } from './table-helpers'

type VirtualizedTableBodyPropsT<TData> = {
  readonly parentRef: React.RefObject<HTMLDivElement | null>
  readonly containerHeight: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly headerGroups: any[]
  readonly rows: Row<TData>[]
  readonly virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>
  readonly colCount: number
  readonly emptyMessage: string
  readonly getRowHref?: (row: TData) => string | undefined
  readonly getRowClassName?: (row: TData) => string
}

export function VirtualizedTableBody<TData>({
  parentRef,
  containerHeight,
  headerGroups,
  rows,
  virtualizer,
  colCount,
  emptyMessage,
  getRowHref,
  getRowClassName,
}: VirtualizedTableBodyPropsT<TData>) {
  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div ref={parentRef} style={{ height: containerHeight, overflow: 'auto' }}>
      <table className="w-full text-sm">
        <TableHeader headerGroups={headerGroups} />
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={colCount} message={emptyMessage} />
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
                    key={row.id}
                    row={row}
                    getRowHref={getRowHref}
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
      </table>
    </div>
  )
}
