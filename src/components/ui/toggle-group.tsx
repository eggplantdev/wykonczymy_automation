'use client'

import type { ReactNode } from 'react'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils/cn'

// `label` stays required as the accessible name even when `icon` replaces it visually.
export type OptionT<T extends string> = { value: T; label: string; icon?: ReactNode }

type PropsT<T extends string> = {
  options: OptionT<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label'?: string
  className?: string
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: PropsT<T>) {
  const activeIndex = options.findIndex((option) => option.value === value)

  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      // Radix emits '' when the active item is re-clicked (deselect); ignore it so one is always picked.
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={ariaLabel}
      className={cn(
        'border-input bg-background relative inline-grid h-8 auto-cols-fr grid-flow-col items-center rounded-md border p-0.5',
        className,
      )}
    >
      <span
        aria-hidden
        className="bg-primary pointer-events-none absolute inset-y-0.5 left-0.5 rounded-sm transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 0.25rem) / ${options.length})`,
          transform: `translateX(${(activeIndex >= 0 ? activeIndex : 0) * 100}%)`,
        }}
      />
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          aria-label={option.icon ? option.label : undefined}
          title={option.icon ? option.label : undefined}
          className="focus-visible:ring-ring/50 text-muted-foreground hover:text-foreground data-[state=on]:text-primary-foreground relative z-10 flex h-full cursor-pointer items-center justify-center rounded-sm px-3 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3"
        >
          {option.icon ?? option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}
