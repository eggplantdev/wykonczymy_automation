'use client'

import { useState } from 'react'
import { CheckIcon, Search, type LucideIcon } from 'lucide-react'
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
  searchable?: boolean
}

export const FILTER_NONE = '__none__'

export function FilterMultiSelect({
  values,
  onValuesChange,
  options,
  label,
  icon: Icon,
  searchable = false,
}: FilterMultiSelectPropsT) {
  const [search, setSearch] = useState('')

  const allValues = options.map((o) => o.value)
  const hasNone = values.length === 1 && values[0] === FILTER_NONE
  const hasNoFilter = values.length === 0
  const selected = hasNone ? [] : hasNoFilter ? allValues : values
  const allSelected = selected.length === options.length

  const filteredOptions = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

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
    <DropdownMenu onOpenChange={(open) => !open && setSearch('')}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('min-w-40 justify-start gap-1.5', allSelected && 'opacity-40')}
        >
          {Icon && <Icon className="size-4" />}
          {label}
          {allSelected ? ': Wszystkie' : ` (${selected.length})`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Widoczne transakcje</DropdownMenuLabel>
        {searchable && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj..."
              className="placeholder:text-muted-foreground h-7 w-full bg-transparent text-sm outline-none"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        )}
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
        <div className="max-h-60 overflow-y-auto">
          {filteredOptions.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onSelect={(e) => e.preventDefault()}
              onClick={() => toggleValue(opt.value)}
            >
              <CheckIcon className={cn('size-4', !selected.includes(opt.value) && 'opacity-0')} />
              {opt.label}
            </DropdownMenuItem>
          ))}
          {searchable && filteredOptions.length === 0 && (
            <div className="text-muted-foreground px-2 py-1.5 text-sm">Brak wyników</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
