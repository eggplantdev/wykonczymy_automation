'use client'

import { useState, type ReactElement } from 'react'
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
import { SELECT_TRIGGER_CLASS } from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import { useTranslation } from '@/hooks/use-translation'

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
  size?: 'xs' | 'sm' | 'default'
  trigger?: (state: { selectedLabel: string | undefined; open: boolean }) => ReactElement
  className?: string
}

export function SearchSelect({
  value,
  onChange,
  items,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled,
  id,
  onBlur,
  isInvalid,
  size = 'default',
  trigger,
  className,
}: SearchSelectPropsT) {
  const { t } = useTranslation('filters')
  const [open, setOpen] = useState(false)
  const selectedLabel = items.find((item) => item.value === value)?.label

  return (
    // `modal`, always: inside a Dialog the dialog's lock kills scrolling over this list.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        {trigger ? (
          trigger({ selectedLabel, open })
        ) : (
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={isInvalid}
            id={id}
            disabled={disabled}
            onBlur={onBlur}
            data-size={size}
            data-placeholder={selectedLabel ? undefined : ''}
            className={cn(SELECT_TRIGGER_CLASS, className)}
          >
            <span className="truncate">{selectedLabel ?? placeholder}</span>
            <Icon iconName="dropdownDown" size="sm" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? t('search')} />
          <CommandList>
            <CommandEmpty>{emptyMessage ?? t('notFound')}</CommandEmpty>
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
