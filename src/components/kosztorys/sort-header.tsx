'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TOOLTIP_DELAY,
} from '@/components/ui/tooltip'
import type { SortDirT } from '@/lib/kosztorys/v2-rows'

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

  // Suppress the hover tooltip while the sort menu is open — otherwise it lingers over the
  // just-opened dropdown. Opening the menu also clears the stale hover flag: Radix never fires the
  // tooltip's close (it's already forced shut), so without this it would pop back the moment the
  // menu closes, cursor gone.
  const [menuOpen, setMenuOpen] = useState(false)
  const [tipHovered, setTipHovered] = useState(false)

  const onMenuOpenChange = (open: boolean) => {
    setMenuOpen(open)
    if (open) setTipHovered(false)
  }

  const trigger = (
    <DropdownMenuTrigger
      title={tip ? undefined : 'Sortuj kolumnę'}
      className={cn(
        'hover:bg-accent flex h-full w-full cursor-pointer items-center gap-1 rounded px-1 text-left font-medium outline-none',
        active && 'text-primary font-semibold',
      )}
    >
      <span className="truncate">{label}</span>
      <Icon className={cn('size-4 shrink-0', active ? 'opacity-100' : 'opacity-50')} />
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
      {tip ? (
        <TooltipProvider delayDuration={TOOLTIP_DELAY}>
          <Tooltip open={tipHovered && !menuOpen} onOpenChange={setTipHovered}>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent>{tip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}
      {/* Don't refocus the trigger on close — a Radix Tooltip opens on focus, so the returned
          focus would re-pop the tip after a click-outside. */}
      <DropdownMenuContent
        align="start"
        className="min-w-40"
        onCloseAutoFocus={(e) => e.preventDefault()}
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
