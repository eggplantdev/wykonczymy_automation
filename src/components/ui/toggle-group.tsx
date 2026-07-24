'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils/cn'

// `label` stays required as the accessible name even when `icon` replaces it visually.
export type OptionT<T extends string> = { value: T; label: string; icon?: ReactNode }

type SizeT = 'default' | 'lg'

type PropsT<T extends string> = {
  options: OptionT<T>[]
  value: T
  onChange: (value: T) => void
  size?: SizeT
  // Greys out and blocks interaction while keeping the group visible — used where a toggle applies
  // only in some contexts (e.g. the summary view toggle on the subcontractor plane).
  disabled?: boolean
  'aria-label'?: string
}

const ROOT_SIZE: Record<SizeT, string> = {
  default: 'h-8',
  lg: 'h-11',
}

const ITEM_SIZE: Record<SizeT, string> = {
  default: 'px-3 text-xs',
  lg: 'px-5 text-sm',
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  size = 'default',
  disabled = false,
  'aria-label': ariaLabel,
}: PropsT<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  // Columns are content-sized (auto-cols-max), so the indicator can't be derived from an index —
  // measure the active item and position the pill by direct style writes (state would cascade renders).
  useLayoutEffect(() => {
    const active = rootRef.current?.querySelector<HTMLElement>('[data-state="on"]')
    const indicator = indicatorRef.current
    if (!active || !indicator) return
    indicator.style.width = `${active.offsetWidth}px`
    indicator.style.transform = `translateX(${active.offsetLeft}px)`
  }, [value, options])

  return (
    <ToggleGroupPrimitive.Root
      ref={rootRef}
      type="single"
      value={value}
      // Radix emits '' when the active item is re-clicked (deselect); ignore it so one is always picked.
      onValueChange={(next) => next && onChange(next as T)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'border-input bg-background relative inline-grid auto-cols-max grid-flow-col items-center rounded-md border p-0.5',
        ROOT_SIZE[size],
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {/* w-0 until the layout effect measures the active item — invisible pre-hydration. */}
      <span
        ref={indicatorRef}
        aria-hidden
        className="bg-primary pointer-events-none absolute inset-y-0.5 w-0 rounded-sm transition-[transform,width] duration-200 ease-out"
      />
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          aria-label={option.icon ? option.label : undefined}
          title={option.icon ? option.label : undefined}
          className={cn(
            'focus-visible:ring-ring/50 text-muted-foreground hover:text-foreground data-[state=on]:text-primary-foreground relative z-10 flex h-full cursor-pointer items-center justify-center rounded-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
            ITEM_SIZE[size],
          )}
        >
          {option.icon ?? option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}
