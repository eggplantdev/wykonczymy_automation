'use client'

import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
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
  const toggleableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanHide() && col.columnDef.meta?.canHide !== false)

  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {}
    for (const col of toggleableColumns) {
      state[col.id] = col.getIsVisible()
    }
    return state
  })

  if (toggleableColumns.length === 0) return null

  function handleToggle(colId: string) {
    const col = table.getColumn(colId)
    if (!col) return
    const next = !col.getIsVisible()
    col.toggleVisibility(next)
    setVisibility((prev) => ({ ...prev, [colId]: next }))
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
            onClick={() => handleToggle(col.id)}
          >
            <CheckIcon className={cn('size-4', !(visibility[col.id] ?? true) && 'opacity-0')} />
            {col.columnDef.meta?.label ?? col.id}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
