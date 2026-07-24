'use client'

import { useState, type ReactNode } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TOOLTIP_DELAY,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  // Trigger content — the label span and its trailing icon; each header styles its own.
  label: ReactNode
  icon: ReactNode
  triggerClassName?: string
  triggerTitle?: string
  tip?: string
  // The DropdownMenuItems for this header's actions.
  children: ReactNode
}

// The one datasheet-grid header primitive: a dropdown trigger that fills the header cell (`h-full
// w-full`, the layout every column header needs) plus its portaled menu. Every sortable/actionable
// column header composes this so the trigger/tooltip/menu-open wiring lives in one place.
export function HeaderMenu({ label, icon, triggerClassName, triggerTitle, tip, children }: PropsT) {
  // Suppress the hover tooltip while the menu is open — otherwise it lingers over the just-opened
  // dropdown. Opening the menu also clears the stale hover flag: Radix never fires the tooltip's
  // close (it's already forced shut), so without this it would pop back the moment the menu closes.
  const [menuOpen, setMenuOpen] = useState(false)
  const [tipHovered, setTipHovered] = useState(false)

  const onMenuOpenChange = (open: boolean) => {
    setMenuOpen(open)
    if (open) setTipHovered(false)
  }

  const trigger = (
    <DropdownMenuTrigger
      title={tip ? undefined : triggerTitle}
      className={cn(
        'hover:bg-accent flex h-full w-full cursor-pointer items-center gap-1 rounded px-1 text-left font-medium outline-none',
        triggerClassName,
      )}
    >
      {label}
      {icon}
    </DropdownMenuTrigger>
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
