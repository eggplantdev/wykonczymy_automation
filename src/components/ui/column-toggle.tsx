'use client'

import { useReducer } from 'react'
import { type Column, type Table } from '@tanstack/react-table'
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
  readonly table: Table<TData>
}

export function ColumnToggle<TData>({ table }: ColumnTogglePropsT<TData>) {
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  const toggleableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanHide() && col.columnDef.meta?.canHide !== false)

  if (toggleableColumns.length === 0) return null

  function handleToggle(col: Column<TData, unknown>) {
    col.toggleVisibility()
    forceRender()
  }

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
            onClick={() => handleToggle(col)}
          >
            <CheckIcon className={cn('size-4', !col.getIsVisible() && 'opacity-0')} />
            {col.columnDef.meta?.label ?? col.id}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
