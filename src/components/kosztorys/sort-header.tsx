'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'
import { HeaderMenu } from '@/components/kosztorys/header-menu'
import type { SortDirT } from '@/lib/kosztorys/row-view'

type PropsT = {
  label: string
  active: SortDirT | null
  onSort: (dir: SortDirT | null) => void
  // Explanatory tooltip composed ONTO the trigger (not a wrapping element) — a second wrapping
  // trigger would fight the dropdown for the click.
  tip?: string
}

export function SortHeader({ label, active, onSort, tip }: PropsT) {
  const Icon = active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ChevronsUpDown

  return (
    <HeaderMenu
      label={<span className="truncate">{label}</span>}
      icon={<Icon className={cn('size-4 shrink-0', active ? 'opacity-100' : 'opacity-50')} />}
      triggerClassName={cn(active && 'text-primary font-semibold')}
      triggerTitle="Sortuj kolumnę"
      tip={tip}
    >
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
    </HeaderMenu>
  )
}
