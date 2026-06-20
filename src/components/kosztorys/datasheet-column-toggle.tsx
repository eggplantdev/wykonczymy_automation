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
import { cn } from '@/lib/cn'

export type ColMetaT = { id: string; label: string }

type PropsT = {
  columns: ColMetaT[]
  hidden: Set<string>
  onToggle: (id: string) => void
}

// Odpowiednik ColumnToggle dla siatki v2 (react-datasheet-grid nie ma TanStack API).
// Widoczność kolumn trzyma rodzic jako Set ukrytych id.
export function DatasheetColumnToggle({ columns, hidden, onToggle }: PropsT) {
  if (columns.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="size-4" />
          Kolumny
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Widoczne kolumny</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onSelect={(e) => e.preventDefault()}
            onClick={() => onToggle(c.id)}
          >
            <CheckIcon className={cn('size-4', hidden.has(c.id) && 'opacity-0')} />
            {c.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
