'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { type ReactNode } from 'react'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'

// The bottom-anchored overlay both summary panels open into — the owner's/investor's and the
// worker's. `hasRows` is required on purpose: it picks which localStorage key this panel and its
// toggle bind to, so a call site that forgot it would silently drive a different key than the button
// next to it.
export function TotalsPanelOverlay({
  hasRows,
  children,
}: {
  hasRows: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useTotalsPanelOpen(hasRows)

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="border-border bg-background text-foreground shadow-panel absolute inset-x-0 bottom-0 z-20 flex h-0 flex-col overflow-hidden border-t transition-[height] duration-200 ease-out data-[state=closed]:border-transparent data-[state=closed]:shadow-none data-[state=open]:h-full"
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
