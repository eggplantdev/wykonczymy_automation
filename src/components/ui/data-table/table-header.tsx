'use client'

import { flexRender } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TableHeader({ headerGroups }: { headerGroups: any[] }) {
  return (
    <thead>
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id} className="border-border bg-muted/50 border-b">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {headerGroup.headers.map((header: any) => {
            const canSort = header.column.getCanSort()
            const sorted = header.column.getIsSorted()

            return (
              <th
                key={header.id}
                className={cn(
                  'text-muted-foreground px-4 py-3 text-left text-sm font-medium',
                  canSort && 'cursor-pointer select-none',
                )}
                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {canSort && <SortIcon sorted={sorted} />}
                </span>
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
