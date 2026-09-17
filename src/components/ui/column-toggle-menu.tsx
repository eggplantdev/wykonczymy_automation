'use client'

import { ArrowUpDown, CheckCheck, CheckIcon, Settings2 } from 'lucide-react'
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
// table instance. TanStack tables reach it through <ColumnToggle>; the kosztorys grid builds its own
// menu around the same item shape, so the two pickers stay legible as one pattern.

export type ColumnToggleItemT = {
  id: string
  label: string
  visible: boolean
}

type PropsT = {
  items: ColumnToggleItemT[]
  onToggle: (id: string) => void
  onToggleAll: (visible: boolean) => void
  onOpenOrder?: () => void
  className?: string
}

export function ColumnToggleMenu({ items, onToggle, onToggleAll, onOpenOrder, className }: PropsT) {
  if (items.length === 0) return null

  const allVisible = items.every((item) => item.visible)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
          <Settings2 />
          Kolumny
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {onOpenOrder && (
          <>
            <DropdownMenuItem onSelect={onOpenOrder}>
              <ArrowUpDown />
              Ustaw kolejność kolumn…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>Widoczne kolumny</DropdownMenuLabel>
        {/* Same shape as the filter menus' bulk row (`filter-multi-select.tsx`): first row of the
            list it acts on, icon is the plural of theirs. No state tick — the label already names
            the direction. */}
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          onClick={() => onToggleAll(!allVisible)}
        >
          <CheckCheck />
          {allVisible ? 'Ukryj wszystkie' : 'Pokaż wszystkie'}
        </DropdownMenuItem>
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
