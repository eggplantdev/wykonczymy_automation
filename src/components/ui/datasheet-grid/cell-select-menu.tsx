'use client'

import { Check, ChevronDown } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'

type OptionT = { value: string; label: string }

type PropsT = {
  value: string
  options: OptionT[]
  onChange: (value: string) => void
  // Drop the chevron for very narrow columns (e.g. Rabat) where it crowds the value.
  hideChevron?: boolean
  // Forces the menu open — how a caller hands the cell to the keyboard, since a dropdown that only
  // a click can open is a cell no keyboard reaches. Left undefined the menu governs itself, exactly
  // as before, so a caller that doesn't wire the grid's editing flag is unaffected.
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CellSelectMenu({
  value,
  options,
  onChange,
  hideChevron,
  open,
  onOpenChange,
}: PropsT) {
  const active = options.find((option) => option.value === value)

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {/* size-full: whole cell is the click target, else dsg selects the dead space around the text. */}
      <DropdownMenuTrigger className="hover:bg-accent flex size-full cursor-pointer items-center justify-between gap-1 grid-cell-text px-2 outline-none">
        <span className="truncate">{active?.label}</span>
        {!hideChevron && <ChevronDown className="opacity-50" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onChange(option.value)}>
            <Check className={cn(option.value === value ? 'opacity-100' : 'opacity-0')} />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
