'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { type ReactNode } from 'react'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'
import { cn } from '@/lib/utils/cn'

// `hasRows` is required on purpose: it picks which localStorage key this panel and its toggle bind
// to, so a call site that forgot it would silently drive a different key than the button next to it.
// `fixed` is for a page that scrolls as a whole: there the grid area is as tall as every row, so a
// panel filling it would sit pages below the screen the reader is looking at.
export function TotalsPanelOverlay({
  hasRows,
  fixed = false,
  children,
}: {
  hasRows: boolean
  fixed?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useTotalsPanelOpen(hasRows)

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        'border-border bg-background text-foreground shadow-panel inset-x-0 bottom-0 flex h-0 flex-col overflow-hidden border-t transition-[height] duration-200 ease-out data-[state=closed]:border-transparent data-[state=closed]:shadow-none',
        fixed ? 'fixed z-40 data-[state=open]:h-dvh' : 'absolute z-20 data-[state=open]:h-full',
      )}
    >
      <Collapsible.Content
        forceMount
        className="flex min-h-0 flex-1 flex-col overflow-hidden transition-[visibility] duration-200 data-[state=closed]:invisible"
      >
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
