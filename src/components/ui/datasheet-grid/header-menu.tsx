'use client'

import { useState, type ReactNode } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { HeaderMenuTrigger } from '@/components/ui/datasheet-grid/header-menu-trigger'
import { useHeaderMenuExtension } from '@/components/ui/datasheet-grid/header-menu-extension'
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
  tip?: string
  children: ReactNode
}

export function HeaderMenu({ label, icon, triggerClassName, tip, children }: PropsT) {
  // Opening the menu also clears the stale hover flag: Radix never fires the tooltip's
  // close (it's already forced shut), so without this it would pop back the moment the menu closes.
  const [menuOpen, setMenuOpen] = useState(false)
  const [tipHovered, setTipHovered] = useState(false)
  const { columnId, extension } = useHeaderMenuExtension()
  const [targetIds, setTargetIds] = useState<string[]>([])
  const extended = columnId != null && extension != null

  const onMenuOpenChange = (open: boolean) => {
    setMenuOpen(open)
    if (open) setTipHovered(false)
    if (open && extended) setTargetIds(extension.targetIds(columnId))
  }

  // Without stopping Shift+pointerdown before Radix cancels it, the grid never gets the mousedown
  // that extends its column selection.
  const trigger = (
    <HeaderMenuTrigger
      className={triggerClassName}
      onPointerDownCapture={(e) => {
        if (extended && e.shiftKey) e.stopPropagation()
      }}
    >
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
        {menuOpen && extended && targetIds.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {extension.items(targetIds)}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
