'use client'

import * as React from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils/cn'

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'animate-in bg-foreground text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance whitespace-pre-line',
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

// Shared hover delay for every app tooltip, so retuning it is one edit.
const TOOLTIP_DELAY = 500

type SimpleTooltipPropsT = {
  content: string
  children: React.ReactNode
  className?: string
  delayDuration?: number // hover ms before open
}

// Base tooltip. Use directly on INTERACTIVE triggers (buttons, toggles, sortable headers) — the
// trigger keeps its own cursor. For a read-only explanation on plain text/fields use HintTooltip.
function SimpleTooltip({
  content,
  children,
  className,
  delayDuration = TOOLTIP_DELAY,
}: SimpleTooltipPropsT) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className={className}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

type HintTooltipPropsT = SimpleTooltipPropsT

// Read-only explanation on non-interactive content: wraps the trigger in a `cursor-help` span so the
// `?` cursor signals "hint, not control". `className` styles that wrapper (pass the trigger's own
// text classes here). InfoTooltip is the icon flavor of the same thing.
function HintTooltip({ children, className, ...props }: HintTooltipPropsT) {
  return (
    <SimpleTooltip {...props}>
      <span className={cn('inline-flex cursor-help', className)}>{children}</span>
    </SimpleTooltip>
  )
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  SimpleTooltip,
  HintTooltip,
  TOOLTIP_DELAY,
}
