'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, type LucideIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { FilterTriggerButton } from '@/components/transfers/filter-trigger-button'
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

// URL param encoding: [] = all selected (no filter), ['__none__'] = nothing selected
export const FILTER_NONE = '__none__'
const DEBOUNCE_MS = 800

export function FilterMultiSelect({
  values,
  onValuesChange,
  options,
  label,
  icon: Icon,
  searchable = false,
}: FilterMultiSelectPropsT) {
  const [open, setOpen] = useState(false)
  const [localSelected, setLocalSelected] = useState<string[] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  const allValues = options.map((o) => o.value)

  // Decode URL params → actual selection (inverse of flush)
  function deriveSelected(vals: string[]) {
    const hasNone = vals.length === 1 && vals[0] === FILTER_NONE
    const hasNoFilter = vals.length === 0
    return hasNone ? [] : hasNoFilter ? allValues : vals
  }

  // While open, use local state. While closed, use props.
  const selected = localSelected ?? deriveSelected(values)
  const allSelected = selected.length === options.length

  // Encode selection → URL params (inverse of deriveSelected)
  function flush(next: string[]) {
    const allAreSelected = next.length === options.length
    if (allAreSelected) onValuesChange([])
    else if (next.length === 0) onValuesChange([FILTER_NONE])
    else onValuesChange(next)
  }

  function scheduleFlush(next: string[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      flush(next)
      debounceRef.current = null
    }, DEBOUNCE_MS)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setLocalSelected(deriveSelected(values))
      setOpen(true)
      return
    }

    // If there's a pending debounce, flush immediately on close
    if (debounceRef.current && localSelected) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      flush(localSelected)
    }
    setLocalSelected(null)
    setOpen(false)
  }

  function toggleValue(value: string) {
    const isSelected = selected.includes(value)
    const next = isSelected ? selected.filter((v) => v !== value) : [...selected, value]
    const result = next.length === 0 ? [] : next
    setLocalSelected(result)
    scheduleFlush(result)
  }

  function toggleAll() {
    /*  */
    const next = allSelected ? [] : [...allValues]
    setLocalSelected(next)
    scheduleFlush(next)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <FilterTriggerButton active={!allSelected} icon={Icon}>
          {label}
          {allSelected ? '' : ` (${selected.length})`}
        </FilterTriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder="Szukaj..." />}
          <CommandList>
            <CommandGroup>
              <CommandItem onSelect={toggleAll} className="font-medium">
                <CheckIcon className={cn('size-4', !allSelected && 'opacity-0')} />
                {allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => toggleValue(opt.value)}
                >
                  <CheckIcon
                    className={cn('size-4', !selected.includes(opt.value) && 'opacity-0')}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandEmpty>Brak wyników</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
