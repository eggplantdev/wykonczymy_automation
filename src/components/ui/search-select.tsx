'use client'

import { useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import Icon from '@/components/ui/icons/icon'
import { cn } from '@/lib/utils/cn'

export type SearchSelectItemT = {
  value: string
  label: string
}

type SearchSelectPropsT = {
  value: string
  onChange: (value: string) => void
  items: SearchSelectItemT[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  id?: string
  onBlur?: () => void
  isInvalid?: boolean
  className?: string
}

/**
 * Searchable single-pick select. The search box is the whole point: a list of dozens (inwestycje,
 * pracownicy) is unusable as a plain `SimpleSelect`, so any surface picking from one reaches for
 * this — `FormCombobox` is the TanStack-field wrapper around it, not a second implementation.
 */
export function SearchSelect({
  value,
  onChange,
  items,
  placeholder,
  searchPlaceholder = 'Szukaj...',
  emptyMessage = 'Nie znaleziono.',
  disabled,
  id,
  onBlur,
  isInvalid,
  className,
}: SearchSelectPropsT) {
  const [open, setOpen] = useState(false)
  const selectedLabel = items.find((item) => item.value === value)?.label

  return (
    // `modal`, always: the content portals to body, so inside a Dialog it is the dialog's sibling.
    // `react-remove-scroll` lets only the top lock on its stack handle `wheel` and cancels what
    // falls outside that lock's ref, so the dialog's lock kills scrolling over this list while
    // cmdk's `scrollIntoView` keeps the arrows working. Modal pushes a lock scoped to this content.
    // Opt-in on `Combobox` only because a datasheet cell must keep body scroll; nothing here does.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={isInvalid}
          id={id}
          disabled={disabled}
          onBlur={onBlur}
          className={cn(
            'border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive bg-background text-foreground flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2',
            !selectedLabel && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <Icon iconName="dropdownDown" size="sm" />
        </button>
      </PopoverTrigger>
      {/* Above a dialog: the picker is opened from inside one often enough that the exception is
          the rule here. */}
      <PopoverContent className="z-10001 w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  onSelect={() => {
                    onChange(item.value === value ? '' : item.value)
                    setOpen(false)
                  }}
                >
                  {item.label}
                  <CheckIcon
                    className={cn('ml-auto', value === item.value ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
