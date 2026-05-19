'use client'

// Clickable table row with navigation support.
// Clicking the row navigates to the detail page,
// but clicks on interactive elements (<a>, <button>) are ignored
// so inline actions (toggles, links) work independently.

import React from 'react'
import { flexRender, type Row } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'

type DataTableRowPropsT<TData> = {
  row: Row<TData>
  visibleColumnIds: Set<string>
  getRowHref?: (row: TData) => string | undefined
  getRowClassName?: (row: TData) => string
}

export function DataTableRow<TData>({
  row,
  visibleColumnIds,
  getRowHref,
  getRowClassName,
}: DataTableRowPropsT<TData>) {
  const router = useRouter()
  const href = getRowHref?.(row.original)

  function handleClick(e: React.MouseEvent<HTMLTableRowElement>) {
    if (!href) return

    const target = e.target as HTMLElement

    // Ignore events that bubbled from a React portal (e.g., Dialog content).
    // React synthetic events propagate through the component tree, not the DOM,
    // so a click inside a portaled dialog still reaches this handler.
    if (!e.currentTarget.contains(target)) return

    // Skip if the click landed on an interactive element (button, link)
    if (target.closest('a, button')) return

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
        href && 'hover:bg-muted cursor-pointer transition-colors',
        getRowClassName?.(row.original),
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      {row
        .getAllCells()
        .filter((cell) => visibleColumnIds.has(cell.column.id))
        .map((cell) => {
          const align = cell.column.columnDef.meta?.align
          return (
            <td
              key={cell.id}
              className={cn('text-foreground px-3 py-2', align === 'right' && 'text-right')}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          )
        })}
    </tr>
  )
}
