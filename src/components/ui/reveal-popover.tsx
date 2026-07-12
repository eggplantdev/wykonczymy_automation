'use client'

import { useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'

type RevealPopoverPropsT = {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  // Opt out of hover-to-open. Click/tap always opens, so touch devices keep access either way.
  clickOnly?: boolean
  triggerClassName?: string
  contentClassName?: string
}

// Reveals arbitrary content in a consistently-styled, scrollable panel.
// The trigger is caller-owned — anything it needs (truncation, layout) is its concern, not the panel's.
export function RevealPopover({
  trigger,
  children,
  align = 'start',
  clickOnly = false,
  triggerClassName,
  contentClassName,
}: RevealPopoverPropsT) {
  const [open, setOpen] = useState(false)
  const hoverProps = clickOnly
    ? {}
    : { onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false) }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn('cursor-pointer text-left', triggerClassName)} {...hoverProps}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn('max-h-80 w-80 overflow-y-auto', contentClassName)}
        {...hoverProps}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
