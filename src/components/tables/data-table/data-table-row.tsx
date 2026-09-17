'use client'

// Clickable table row. Clicking it opens the row's subject — by navigating to `getRowHref`, or, for
// a row whose opening is a WRITE and so must not be prefetchable, by calling `onRowClick`.

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

    // React events bubble through the component tree, not the DOM — a click inside a portaled
    // dialog still reaches here, so it's ignored via containment check.
    if (!e.currentTarget.contains(target)) return

    if (target.closest('a, button')) return

    if (!href) {
      onRowClick?.(row.original)
      return
    }

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
