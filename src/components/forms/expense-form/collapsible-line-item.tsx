'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { DECISION_TONE, type DecisionStatusT } from '@/components/ui/decision-progress-badge'
import { cn } from '@/lib/utils/cn'

const STATUS_LABEL: Record<DecisionStatusT, string> = {
  pending: 'Do sprawdzenia',
  accepted: 'Przyjęty',
  rejected: 'Odrzucony',
}

type CollapsibleLineItemPropsT = {
  title: string
  status: DecisionStatusT
  defaultOpen: boolean
  leading?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}

export function CollapsibleLineItem({
  title,
  status,
  defaultOpen,
  leading,
  action,
  children,
}: CollapsibleLineItemPropsT) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const isDecided = status !== 'pending'

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('flex items-center gap-2', isDecided && 'opacity-60')}>
        {leading}
        <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 text-left">
          <CollapsibleChevron open={isOpen} className="text-muted-foreground size-4" />
          <span
            className={cn(
              'min-w-0 truncate text-sm font-medium',
              status === 'rejected' && 'line-through',
            )}
          >
            {title}
          </span>
          <Badge tone={DECISION_TONE[status]} className="shrink-0">
            {STATUS_LABEL[status]}
          </Badge>
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent>
        <fieldset disabled={isDecided} className="min-w-0 pt-2">
          {children}
        </fieldset>
      </CollapsibleContent>
    </Collapsible>
  )
}
