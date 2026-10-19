'use client'

import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('flex items-center gap-2', isDecided && 'opacity-60')}>
        {leading}
        <Collapsible.Trigger className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 text-left">
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
              !isOpen && '-rotate-90',
            )}
          />
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
        </Collapsible.Trigger>
        {action}
      </div>
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
        <fieldset disabled={isDecided} className="min-w-0 pt-2">
          {children}
        </fieldset>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
