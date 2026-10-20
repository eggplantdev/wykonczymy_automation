'use client'

import type { ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'

type BadgeSelectOptionT<TValue extends string> = {
  value: TValue
  badge: ReactNode
  description?: ReactNode
}

type PropsT<TValue extends string> = {
  value: TValue
  options: readonly BadgeSelectOptionT<TValue>[]
  onValueChange: (value: TValue) => void
  disabled?: boolean
  hideChevron?: boolean
}

export function BadgeSelect<TValue extends string>({
  value,
  options,
  onValueChange,
  disabled,
  hideChevron,
}: PropsT<TValue>) {
  function handleValueChange(next: string) {
    const option = options.find((candidate) => candidate.value === next)
    if (option) onValueChange(option.value)
  }
  const selected = options.find((option) => option.value === value)
  const hasDescriptions = options.some((option) => option.description)

  return (
    <Select value={value} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          'w-fit cursor-pointer gap-1 border-0 bg-transparent px-0 shadow-none enabled:hover:opacity-70 data-[size=default]:h-auto',
          hideChevron && '[&>svg]:hidden',
        )}
      >
        {/* Radix mirrors the whole item into the trigger; given children it shows those instead, so
            the closed select carries the badge without the description. */}
        <SelectValue>{selected?.badge}</SelectValue>
      </SelectTrigger>
      <SelectContent className={hasDescriptions ? 'w-80' : 'w-fit min-w-0'}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className={cn(
              'cursor-pointer pr-2 opacity-60 transition-opacity hover:opacity-100 focus:bg-transparent data-highlighted:opacity-100 data-[state=checked]:opacity-100 [&>[data-slot=select-item-indicator]]:hidden',
              hasDescriptions && 'py-2',
            )}
          >
            {option.description ? (
              <div className="flex flex-col items-start gap-1.5">
                {option.badge}
                <span className="text-muted-foreground px-1.5 text-xs">{option.description}</span>
              </div>
            ) : (
              option.badge
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
