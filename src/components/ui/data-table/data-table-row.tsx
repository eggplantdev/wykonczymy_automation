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
  readonly row: Row<TData>
  readonly getRowHref?: (row: TData) => string | undefined
  readonly getRowClassName?: (row: TData) => string
}

export function DataTableRow<TData>({
  row,
  getRowHref,
  getRowClassName,
}: DataTableRowPropsT<TData>) {
  const router = useRouter()
  const href = getRowHref?.(row.original)

  function handleClick(e: React.MouseEvent<HTMLTableRowElement>) {
    if (!href) return

    // Skip if the click landed on an interactive element (button, link)
    const target = e.target as HTMLElement
    if (target.closest('a, button')) return

    // Cmd/Ctrl+click opens in new tab
    if (e.metaKey || e.ctrlKey) {
      window.open(href, '_blank')
    } else {
      router.push(href)
    }
  }

  return (
    <tr
      className={cn(
        'border-border border-b last:border-b-0',
        href && 'hover:bg-muted cursor-pointer transition-colors',
        getRowClassName?.(row.original),
      )}
      onClick={handleClick}
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="text-foreground px-4 py-3">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  )
}
