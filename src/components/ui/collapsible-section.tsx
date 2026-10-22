'use client'

import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Separator } from '@/components/ui/separator'
import * as Collapsible from '@/components/ui/collapsible'
import { Description } from '@/components/ui/description'
import { SECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { useSectionOpen } from '@/hooks/use-section-open'

type CollapsibleSectionSizeT = 'lg' | 'sm' | 'compact'

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

const SIZE: Record<CollapsibleSectionSizeT, { title: string; chevron: string; trigger: string }> = {
  lg: { title: SECTION_TITLE_CLASS, chevron: 'size-5', trigger: 'py-2' },
  sm: { title: 'text-sm font-medium', chevron: 'size-4', trigger: 'py-2' },
  compact: { title: 'text-sm font-medium', chevron: 'size-4', trigger: 'min-h-7' },
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
          <Collapsible.Trigger
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 text-left',
              SIZE[size].trigger,
            )}
          >
            {Icon && (
              <Icon className={cn('text-foreground shrink-0', SIZE[size].chevron)} aria-hidden />
            )}
            <h2 className={cn('text-foreground', SIZE[size].title)}>{title}</h2>
            <Collapsible.Chevron
              open={isOpen}
              className={cn('text-muted-foreground', SIZE[size].chevron)}
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
      <Collapsible.Content className={cn(!withSeparator && 'pt-2')}>{children}</Collapsible.Content>
    </Collapsible.Root>
  )
}
