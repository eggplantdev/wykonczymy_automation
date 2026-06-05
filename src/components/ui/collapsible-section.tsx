'use client'

import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

type CollapsibleSectionPropsT = {
  title: string
  id?: string
  defaultOpen?: boolean
  className?: string
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  id,
  defaultOpen = true,
  children,
}: CollapsibleSectionPropsT) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible.Root id={id} open={isOpen} onOpenChange={setIsOpen} className={''}>
      <Collapsible.Trigger className="flex w-full cursor-pointer items-center gap-2 text-left">
        <h2 className="text-foreground text-lg font-semibold">{title}</h2>
        <ChevronDown
          className={cn(
            'text-muted-foreground size-5 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
