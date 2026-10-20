'use client'

import { useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TextButton } from '@/components/ui/text-link'
import { HintTooltip } from '@/components/ui/tooltip'

type InfoTooltipPropsT = {
  content: ReactNode
  label?: string
  className?: string
}

export function InfoTooltip({
  content,
  label = 'Więcej informacji',
  className,
}: InfoTooltipPropsT) {
  const [open, setOpen] = useState(false)

  return (
    <HintTooltip
      content={content}
      open={open}
      onOpenChange={setOpen}
      className={cn('align-middle', className)}
    >
      <TextButton
        aria-label={label}
        // Radix's Trigger — the element HintTooltip wraps this button in — closes the tooltip on pointerdown, and its composeEventHandlers skips that once the event is `defaultPrevented`.
        onPointerDown={(event) => {
          event.preventDefault()
          setOpen((wasOpen) => !wasOpen)
        }}
      >
        <Info className="size-3.5" />
      </TextButton>
    </HintTooltip>
  )
}
