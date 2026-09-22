'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { type ComponentProps } from 'react'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'

// Owns the overlay geometry, nothing of what is displayed — that all lives in SummaryPanelContent, so
// the investment page can mount the same content without inheriting the editor's bottom-anchored
// collapsible.
// `hasRows` is required on purpose: it picks which localStorage key this panel and its toggle bind
// to, so a call site that forgot it would silently drive a different key than the button next to it.
export function KosztorysTotalsPanel({
  hasRows,
  ...props
}: ComponentProps<typeof SummaryPanelContent> & { hasRows: boolean }) {
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
        <SummaryPanelContent {...props} />
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
