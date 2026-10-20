'use client'

import * as React from 'react'
import { Collapsible as CollapsiblePrimitive } from 'radix-ui'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
}

function CollapsibleContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      // Clip only the y axis the animation runs on — clipping x too cuts the focus rings and glows
      // of full-width children.
      className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-y-clip"
      {...props}
    >
      {/* Padding on Content itself would survive the animation's height: 0. */}
      <div className={className}>{children}</div>
    </CollapsiblePrimitive.Content>
  )
}

function CollapsibleChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronDown
      aria-hidden
      className={cn('shrink-0 transition-transform duration-200', open && 'rotate-180', className)}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleChevron }
