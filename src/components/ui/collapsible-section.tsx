'use client'

import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Separator } from '@/components/ui/separator'
import { Description } from '@/components/ui/description'
import { SECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { usePersistedFlag } from '@/hooks/use-persisted-value'

type CollapsibleSectionSizeT = 'lg' | 'sm'

type CollapsibleSectionPropsT = {
  title: string
  icon?: LucideIcon
  id?: string
  defaultOpen?: boolean
  storageKey?: string
  size?: CollapsibleSectionSizeT
  withSeparator?: boolean
  hint?: React.ReactNode
  // Rendered beside the trigger: a button nested in the trigger button is invalid markup.
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}

const SIZE: Record<CollapsibleSectionSizeT, { title: string; chevron: string }> = {
  lg: { title: SECTION_TITLE_CLASS, chevron: 'size-5' },
  sm: { title: 'text-sm font-medium', chevron: 'size-4' },
}

export const OPEN_STATES = ['open', 'closed'] as const

function useSectionOpen(
  storageKey: string | undefined,
  defaultOpen: boolean,
): [boolean, (open: boolean) => void] {
  const [local, setLocal] = useState(defaultOpen)
  const stored = usePersistedFlag(storageKey ?? '', OPEN_STATES, defaultOpen)

  return storageKey ? stored : [local, setLocal]
}

export function CollapsibleSection({
  title,
  icon: Icon,
  id,
  defaultOpen = true,
  storageKey,
  size = 'lg',
  withSeparator = true,
  hint,
  action,
  className,
  children,
}: CollapsibleSectionPropsT) {
  const [isOpen, setIsOpen] = useSectionOpen(storageKey, defaultOpen)

  return (
    <Collapsible.Root id={id} open={isOpen} onOpenChange={setIsOpen} className={cn(className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div className="min-w-0 flex-1">
          <Collapsible.Trigger className="flex w-full cursor-pointer items-center gap-2 py-2 text-left">
            {Icon && (
              <Icon className={cn('text-foreground shrink-0', SIZE[size].chevron)} aria-hidden />
            )}
            <h2 className={cn('text-foreground', SIZE[size].title)}>{title}</h2>
            <ChevronDown
              className={cn(
                'text-muted-foreground transition-transform duration-200',
                SIZE[size].chevron,
                isOpen && 'rotate-180',
              )}
            />
          </Collapsible.Trigger>
          {hint && (
            <Description size="xs" className="-mt-2 pb-2">
              {hint}
            </Description>
          )}
        </div>
        {action && <div className="shrink-0 pb-2 sm:pb-0">{action}</div>}
      </div>
      {isOpen && withSeparator && <Separator orientation="horizontal" />}
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
        {/* Padding on Content itself would survive the collapse animation's height: 0. */}
        {withSeparator ? children : <div className="pt-2">{children}</div>}
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
