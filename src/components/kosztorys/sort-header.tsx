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
import { SimpleTooltip } from '@/components/ui/tooltip'
import type { SortDirT } from '@/lib/kosztorys/v2-rows'

type PropsT = {
  label: string
  active: SortDirT | null
  onSort: (dir: SortDirT | null) => void
  // Match the column's cell alignment (numbers right, text left) so the label sits over its values.
  align?: 'left' | 'right'
  // Explanatory tooltip composed ONTO the trigger (not a wrapping element) — a second wrapping
  // trigger would fight the dropdown for the click.
  tip?: string
}

export function SortHeader({ label, active, onSort, align = 'left', tip }: PropsT) {
  const Icon = active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ChevronsUpDown
  const alignRight = align === 'right'

  const trigger = (
    <DropdownMenuTrigger
      title={tip ? undefined : 'Sortuj kolumnę'}
      className={cn(
        'hover:bg-accent flex h-full w-full cursor-pointer items-center gap-1 rounded px-1 font-medium outline-none',
        alignRight ? 'flex-row-reverse text-right' : 'text-left',
        active && 'text-primary font-semibold',
      )}
    >
      <span className="truncate">{label}</span>
      <Icon className={cn('size-4 shrink-0', active ? 'opacity-100' : 'opacity-50')} />
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu>
      {tip ? (
        <SimpleTooltip content={tip} delayDuration={600} className="max-w-xs whitespace-pre-line">
          {trigger}
        </SimpleTooltip>
      ) : (
        trigger
      )}
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
