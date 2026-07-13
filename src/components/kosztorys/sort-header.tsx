'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'
import type { SortDirT } from '@/lib/kosztorys/v2-rows'

type PropsT = {
  label: string
  active: SortDirT | null
  onSort: (dir: SortDirT | null) => void
}

export function SortHeader({ label, active, onSort }: PropsT) {
  const Icon = active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ChevronsUpDown

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Sortuj kolumnę"
        className="hover:bg-accent flex h-full w-full cursor-pointer items-center gap-1 rounded px-1 text-left font-medium outline-none"
      >
        <span className="truncate">{label}</span>
        <Icon className={cn('size-4 shrink-0', active ? 'opacity-100' : 'opacity-50')} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuItem onSelect={() => onSort('asc')}>
          <ArrowUp className={cn('size-4', active === 'asc' ? 'opacity-100' : 'opacity-50')} />
          Sortuj rosnąco
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSort('desc')}>
          <ArrowDown className={cn('size-4', active === 'desc' ? 'opacity-100' : 'opacity-50')} />
          Sortuj malejąco
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!active} onSelect={() => onSort(null)}>
          <ChevronsUpDown className="size-4 opacity-50" />
          Wyczyść sortowanie
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
