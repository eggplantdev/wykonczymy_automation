'use client'

import { CheckIcon, type LucideIcon } from 'lucide-react'
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

type OptionT = { value: string; label: string }

type FilterMultiSelectPropsT = {
  values: string[]
  onValuesChange: (values: string[]) => void
  options: OptionT[]
  label: string
  icon?: LucideIcon
}

export const FILTER_NONE = '__none__'

export function FilterMultiSelect({
  values,
  onValuesChange,
  options,
  label,
  icon: Icon,
}: FilterMultiSelectPropsT) {
  const allValues = options.map((o) => o.value)
  const hasNone = values.length === 1 && values[0] === FILTER_NONE
  const hasNoFilter = values.length === 0
  const selected = hasNone ? [] : hasNoFilter ? allValues : values
  const allSelected = selected.length === options.length

  function toggleValue(value: string) {
    const isSelected = selected.includes(value)
    const next = isSelected ? selected.filter((v) => v !== value) : [...selected, value]

    if (next.length === 0) return onValuesChange([FILTER_NONE])

    // All selected → clear URL param (means "all")
    onValuesChange(next.length === options.length ? [] : next)
  }

  function toggleAll() {
    onValuesChange(allSelected ? [FILTER_NONE] : [])
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-40 justify-start gap-1.5">
          {Icon && <Icon className="size-4" />}
          {label}
          {!allSelected && ` (${selected.length})`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Widoczne transakcje</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          onClick={toggleAll}
          className="font-medium"
        >
          <CheckIcon className={cn('size-4', !allSelected && 'opacity-0')} />
          {allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={(e) => e.preventDefault()}
            onClick={() => toggleValue(opt.value)}
          >
            <CheckIcon className={cn('size-4', !selected.includes(opt.value) && 'opacity-0')} />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
