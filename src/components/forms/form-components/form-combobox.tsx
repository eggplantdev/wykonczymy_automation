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
import FormBase from './form-base'
import { FormControlPropsT } from '../types/form-types'
import { useFieldContext } from '../hooks/form-hooks'

type ComboboxItemT = {
  value: string
  label: string
}

type FormComboboxPropsT = FormControlPropsT & {
  items: ComboboxItemT[]
  searchPlaceholder?: string
  emptyMessage?: string
}

export function FormCombobox({
  items,
  searchPlaceholder = 'Szukaj...',
  emptyMessage = 'Nie znaleziono.',
  disabled,
  ...props
}: FormComboboxPropsT) {
  const field = useFieldContext<string>()
  const [open, setOpen] = useState(false)
  const isInvalid = field.state.meta.errors.length > 0
  const selectedLabel = items.find((item) => item.value === field.state.value)?.label

  return (
    <FormBase {...props}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={isInvalid}
            id={field.name}
            disabled={disabled}
            onBlur={field.handleBlur}
            className={cn(
              'border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive bg-background text-foreground flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2',
              !selectedLabel && 'text-muted-foreground',
              props.className,
            )}
          >
            <span className="truncate">{selectedLabel ?? props.placeholder}</span>
            <Icon iconName="dropdownDown" size="sm" />
          </button>
        </PopoverTrigger>
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
                      field.handleChange(item.value === field.state.value ? '' : item.value)
                      setOpen(false)
                    }}
                  >
                    {item.label}
                    <CheckIcon
                      className={cn(
                        'ml-auto size-4',
                        field.state.value === item.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FormBase>
  )
}
