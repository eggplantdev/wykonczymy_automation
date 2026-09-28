'use client'

import React from 'react'
import { flexRender, type Row } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

type DataTableRowPropsT<TData> = {
  row: Row<TData>
  getRowHref?: (row: TData) => string | undefined
  getRowClassName?: (row: TData) => string
  /** The virtualizer's `measureElement` — it reads the row's position from `data-index`. */
  measureRef?: (node: HTMLTableRowElement | null) => void
  index?: number
}

export function DataTableRow<TData>({
  row,
  getRowHref,
  getRowClassName,
  measureRef,
  index,
}: DataTableRowPropsT<TData>) {
  const router = useRouter()
  const href = getRowHref?.(row.original)
  const isClickable = Boolean(href)

  function handleClick(e: React.MouseEvent<HTMLTableRowElement>) {
    if (!href) return

    const target = e.target as HTMLElement

    // React events bubble through the component tree, not the DOM — a click inside a portaled
    // dialog still reaches here, so it's ignored via containment check.
    if (!e.currentTarget.contains(target)) return

    if (target.closest('a, button')) return

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
      ref={measureRef}
      data-index={index}
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
