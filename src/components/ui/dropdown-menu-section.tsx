'use client'

import { type ReactNode } from 'react'
import * as Collapsible from '@/components/ui/collapsible'
import { useSectionOpen } from '@/hooks/use-section-open'
import { DropdownMenuItem, DropdownMenuLabel, keepMenuOpen } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  label: ReactNode
  hint?: ReactNode
  // Collapsing needs a key: the menu unmounts its content on close, so a local open state would reset on every open.
  collapseStorageKey?: string
  children: ReactNode
}

export function DropdownMenuSection({ label, hint, collapseStorageKey, children }: PropsT) {
  const [isOpen, setIsOpen] = useSectionOpen(collapseStorageKey, true)

  if (!collapseStorageKey) {
    return (
      <>
        <DropdownMenuLabel className={cn(hint && 'flex items-center justify-between gap-2')}>
          {label}
          {hint}
        </DropdownMenuLabel>
        {children}
      </>
    )
  }

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <Collapsible.Trigger asChild>
        <DropdownMenuItem onSelect={keepMenuOpen()} className="font-medium">
          {label}
          {hint && (
            // A hint whose click isn't defaultPrevented would bubble into the trigger and toggle the section.
            <span className="ml-auto flex" onClick={(event) => event.stopPropagation()}>
              {hint}
            </span>
          )}
          <Collapsible.Chevron open={isOpen} className={hint ? undefined : 'ml-auto'} />
        </DropdownMenuItem>
      </Collapsible.Trigger>
      <Collapsible.Content>{children}</Collapsible.Content>
    </Collapsible.Root>
  )
}
