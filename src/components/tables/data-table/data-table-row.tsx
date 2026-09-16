'use client'

// Clickable table row. Clicking it opens the row's subject — by navigating to `getRowHref`, or, for
// a row whose opening is a WRITE and so must not be prefetchable, by calling `onRowClick`.
// Clicks on interactive elements (<a>, <button>) are ignored so inline actions work independently.

import React from 'react'
import { flexRender, type Row } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

type DataTableRowPropsT<TData> = {
  row: Row<TData>
  getRowHref?: (row: TData) => string | undefined
  onRowClick?: (row: TData) => void
  getRowClassName?: (row: TData) => string
}

export function DataTableRow<TData>({
  row,
  getRowHref,
  onRowClick,
  getRowClassName,
}: DataTableRowPropsT<TData>) {
  const router = useRouter()
  const href = getRowHref?.(row.original)
  const isClickable = Boolean(href) || Boolean(onRowClick)

  function handleClick(e: React.MouseEvent<HTMLTableRowElement>) {
    if (!isClickable) return

    const target = e.target as HTMLElement

    // Ignore events that bubbled from a React portal (e.g., Dialog content).
    // React synthetic events propagate through the component tree, not the DOM,
    // so a click inside a portaled dialog still reaches this handler.
    if (!e.currentTarget.contains(target)) return

    // Skip if the click landed on an interactive element (button, link)
    if (target.closest('a, button')) return

    if (!href) {
      onRowClick?.(row.original)
      return
    }

    // Cmd/Ctrl+click opens in new tab
    if (e.metaKey || e.ctrlKey) {
      window.open(href, '_blank')
    } else {
      router.push(href)
    }
  }

  function handleMouseEnter() {
    if (href) router.prefetch(href)
  }

  return (
    <tr
      className={cn(
        'border-border border-b last:border-b-0',
        isClickable && 'hover:bg-muted cursor-pointer transition-colors',
        getRowClassName?.(row.original),
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      {row.getVisibleCells().map((cell) => {
        const align = cell.column.columnDef.meta?.align
        const minWidth = cell.column.columnDef.meta?.minWidth
        return (
          <td
            key={cell.id}
            className={cn(
              'text-foreground px-3 py-2',
              align === 'right' && 'text-right',
              align === 'center' && 'text-center',
              minWidth,
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        )
      })}
    </tr>
  )
}
