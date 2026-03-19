'use client'

import { type Table, type VisibilityState } from '@tanstack/react-table'
import { CheckIcon, Settings2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

type ColumnTogglePropsT<TData> = {
  table: Table<TData>
  columnVisibility: VisibilityState
}

export function ColumnToggle<TData>({ table, columnVisibility }: ColumnTogglePropsT<TData>) {
  const toggleableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanHide() && col.columnDef.meta?.canHide !== false)

  if (toggleableColumns.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5">
          <Settings2 className="size-4" />
          Kolumny
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Widoczne kolumny</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {toggleableColumns.map((col) => (
          <DropdownMenuItem
            key={col.id}
            onSelect={(e) => e.preventDefault()}
            onClick={() => col.toggleVisibility()}
          >
            <CheckIcon
              className={cn('size-4', columnVisibility[col.id] === false && 'opacity-0')}
            />
            {col.columnDef.meta?.label ??
              (typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
