'use client'

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
import { cn } from '@/lib/utils/cn'

// The column picker's whole presentation, table-library-agnostic: it takes a flat item list, not a
// table instance. TanStack tables reach it through <ColumnToggle>; the kosztorys grid (datasheet-
// grid, no table instance to hand over) renders it directly. One component = the two pickers can't
// drift apart in look or behaviour.

export type ColumnToggleItemT = {
  id: string
  label: string
  visible: boolean
}

type PropsT = {
  items: ColumnToggleItemT[]
  onToggle: (id: string) => void
  className?: string
}

export function ColumnToggleMenu({ items, onToggle, className }: PropsT) {
  if (items.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* ml-auto floats the trigger right in a flat toolbar; a caller that already groups its
            right-hand controls passes ml-0 to opt out. */}
        <Button variant="outline" size="sm" className={cn('ml-auto gap-1.5', className)}>
          <Settings2 />
          Kolumny
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Widoczne kolumny</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            // Plain items + preventDefault, not DropdownMenuCheckboxItem: the menu must survive a
            // toggle so several columns can be flipped in one visit.
            onSelect={(e) => e.preventDefault()}
            onClick={() => onToggle(item.id)}
          >
            <CheckIcon className={cn(!item.visible && 'opacity-0')} />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
