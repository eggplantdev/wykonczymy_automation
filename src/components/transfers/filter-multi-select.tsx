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

export function FilterMultiSelect({ values, onValuesChange, options, label, icon: Icon }: FilterMultiSelectPropsT) {
  const allValues = options.map((o) => o.value)
  const selected = values.length === 0 ? allValues : values
  const allSelected = selected.length === options.length

  function toggleValue(value: string) {
    const isSelected = selected.includes(value)
    const next = isSelected
      ? selected.filter((v) => v !== value)
      : [...selected, value]

    // Prevent deselecting all — at least one must remain
    if (next.length === 0) return

    // All selected → clear URL param (means "all")
    onValuesChange(next.length === options.length ? [] : next)
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
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={(e) => e.preventDefault()}
            onClick={() => toggleValue(opt.value)}
          >
            <CheckIcon
              className={cn('size-4', !selected.includes(opt.value) && 'opacity-0')}
            />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
