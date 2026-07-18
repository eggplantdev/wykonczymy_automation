'use client'

import { useState } from 'react'
import { CheckIcon, type LucideIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { FilterTriggerButton } from '@/components/transfers/filter-trigger-button'
import { cn } from '@/lib/utils/cn'

type FilterOptionT = { value: string; label: string }

type FilterSelectPropsT = {
  value: string
  onValueChange: (value: string) => void
  options: FilterOptionT[]
  placeholder?: string
  icon?: LucideIcon
  searchable?: boolean
}

export function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder = '∞',
  icon: Icon,
  searchable = false,
}: FilterSelectPropsT) {
  const [open, setOpen] = useState(false)
  const selectedLabel = options.find((o) => o.value === value)?.label

  function handleSelect(optionValue: string) {
    onValueChange(optionValue === value ? '' : optionValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterTriggerButton active={!!value} icon={Icon}>
          {selectedLabel ?? placeholder}
        </FilterTriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder="Szukaj..." />}
          <CommandList>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => handleSelect(opt.value)}
                >
                  <CheckIcon className={cn(opt.value !== value && 'opacity-0')} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {searchable && <CommandEmpty>Brak wyników</CommandEmpty>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
