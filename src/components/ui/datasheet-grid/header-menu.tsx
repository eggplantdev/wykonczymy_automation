'use client'

import { useState, type ReactNode } from 'react'

import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { HeaderMenuTrigger } from '@/components/ui/datasheet-grid/header-menu-trigger'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TOOLTIP_DELAY,
} from '@/components/ui/tooltip'

type PropsT = {
  label: ReactNode
  icon: ReactNode
  triggerClassName?: string
  triggerTitle?: string
  tip?: string
  children: ReactNode
}

export function HeaderMenu({ label, icon, triggerClassName, triggerTitle, tip, children }: PropsT) {
  // Opening the menu also clears the stale hover flag: Radix never fires the tooltip's
  // close (it's already forced shut), so without this it would pop back the moment the menu closes.
  const [menuOpen, setMenuOpen] = useState(false)
  const [tipHovered, setTipHovered] = useState(false)

  const onMenuOpenChange = (open: boolean) => {
    setMenuOpen(open)
    if (open) setTipHovered(false)
  }

  const trigger = (
    <HeaderMenuTrigger title={tip ? undefined : triggerTitle} className={triggerClassName}>
      {label}
      {icon}
    </HeaderMenuTrigger>
  )

  return (
    <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
      {tip ? (
        <TooltipProvider delayDuration={TOOLTIP_DELAY}>
          <Tooltip open={tipHovered && !menuOpen} onOpenChange={setTipHovered}>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent>{tip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}
      {/* Don't refocus the trigger on close — a Radix Tooltip opens on focus, so the returned
          focus would re-pop the tip after a click-outside. */}
      <DropdownMenuContent
        align="start"
        className="min-w-40"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
