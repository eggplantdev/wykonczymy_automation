'use client'

import { flexRender, type HeaderGroup } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SimpleTooltip } from '@/components/ui/tooltip'

export function TableHeader<T>({ headerGroups }: { headerGroups: HeaderGroup<T>[] }) {
  return (
    <thead>
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id} className="border-border bg-muted/50 border-b">
          {headerGroup.headers.map((header) => {
            const canSort = header.column.getCanSort()
            const sorted = header.column.getIsSorted()
            const align = header.column.columnDef.meta?.align
            const tooltip = header.column.columnDef.meta?.tooltip
            const minWidth = header.column.columnDef.meta?.minWidth
            const rawHeader = header.column.columnDef.header

            // The header itself is the trigger, matching the kosztorys grid — no (i) icon competing
            // for width with the sort arrow. Radix closes the tip on pointerdown, so the click that
            // sorts also dismisses it instead of leaving it hanging over the re-sorted table.
            const content = (
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                {header.isPlaceholder ? null : flexRender(rawHeader, header.getContext())}
                {canSort && <SortIcon sorted={sorted} />}
              </span>
            )

            return (
              <th
                key={header.id}
                className={cn(
                  'text-muted-foreground px-3 py-2 text-left text-sm font-medium',
                  align === 'right' && 'text-right',
                  align === 'center' && 'text-center',
                  canSort && 'cursor-pointer select-none',
                  minWidth,
                )}
                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
              >
                {tooltip ? <SimpleTooltip content={tooltip}>{content}</SimpleTooltip> : content}
              </th>
            )
          })}
        </tr>
      ))}
    </thead>
  )
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="size-3.5" />
  if (sorted === 'desc') return <ArrowDown className="size-3.5" />
  return <ArrowUpDown className="size-3.5 opacity-40" />
}
