'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TOOLTIP_DELAY,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'

export type OptionT<T extends string> = { value: T; label: string; icon?: ReactNode }

type SizeT = 'default' | 'md' | 'lg'
type VariantT = 'default' | 'muted'

type PropsT<T extends string> = {
  options: OptionT<T>[]
  value: T
  onChange: (value: T) => void
  size?: SizeT
  variant?: VariantT
  disabled?: boolean
  isEqualWidth?: boolean
  'aria-label'?: string
  className?: string
}

const ROOT_SIZE: Record<SizeT, string> = {
  default: 'h-8',
  md: 'h-9',
  lg: 'h-11',
}

const ROOT_VARIANT: Record<VariantT, string> = {
  default: 'border-input bg-background border',
  muted: 'bg-muted',
}

const INDICATOR_VARIANT: Record<VariantT, string> = {
  default: 'bg-primary',
  muted: 'bg-background shadow-sm',
}

const ITEM_ON_VARIANT: Record<VariantT, string> = {
  default: 'data-[state=on]:text-primary-foreground',
  muted: 'data-[state=on]:text-foreground',
}

const ITEM_SIZE: Record<SizeT, string> = {
  default: 'px-3 text-xs',
  md: 'px-4 text-sm',
  lg: 'px-5 text-sm',
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  size = 'default',
  variant = 'default',
  disabled = false,
  isEqualWidth = false,
  'aria-label': ariaLabel,
  className,
}: PropsT<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  // Columns may be content-sized, so the indicator can't be derived from an index.
  useLayoutEffect(() => {
    const active = rootRef.current?.querySelector<HTMLElement>('[data-state="on"]')
    const indicator = indicatorRef.current
    if (!active || !indicator) return
    indicator.style.width = `${active.offsetWidth}px`
    indicator.style.transform = `translateX(${active.offsetLeft}px)`
  }, [value, options])

  return (
    // Stretching the group itself would make the two-option toggles a full-width bar.
    <div className={cn('max-w-full overflow-x-auto', className)}>
      <ToggleGroupPrimitive.Root
        ref={rootRef}
        type="single"
        value={value}
        // Radix emits '' when the active item is re-clicked (deselect); ignore it so one is always picked.
        onValueChange={(next) => next && onChange(next as T)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          'relative inline-grid w-max grid-flow-col items-center rounded-md p-0.5',
          ROOT_VARIANT[variant],
          isEqualWidth ? 'auto-cols-fr' : 'auto-cols-max',
          ROOT_SIZE[size],
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span
          ref={indicatorRef}
          aria-hidden
          className={cn(
            INDICATOR_VARIANT[variant],
            'pointer-events-none absolute inset-y-0.5 w-0 rounded-sm transition-[transform,width] duration-200 ease-out',
          )}
        />
        {options.map((option) => {
          const itemClassName = cn(
            'focus-visible:ring-ring/50 text-muted-foreground hover:text-foreground relative z-10 flex h-full cursor-pointer items-center justify-center rounded-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
            ITEM_ON_VARIANT[variant],
            ITEM_SIZE[size],
          )
          if (!option.icon) {
            return (
              <ToggleGroupPrimitive.Item
                key={option.value}
                value={option.value}
                className={itemClassName}
              >
                {option.label}
              </ToggleGroupPrimitive.Item>
            )
          }
          // The Item sits outside the trigger so its data-state="on" is the one that lands on the button.
          return (
            <TooltipProvider key={option.value} delayDuration={TOOLTIP_DELAY}>
              <Tooltip>
                <ToggleGroupPrimitive.Item asChild value={option.value} aria-label={option.label}>
                  <TooltipTrigger asChild>
                    <button type="button" className={itemClassName}>
                      {option.icon}
                    </button>
                  </TooltipTrigger>
                </ToggleGroupPrimitive.Item>
                <TooltipContent>{option.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </ToggleGroupPrimitive.Root>
    </div>
  )
}
