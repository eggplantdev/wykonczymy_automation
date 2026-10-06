'use client'

import { type ComponentProps } from 'react'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import { TotalsPanelOverlay } from '@/components/kosztorys/summary/totals-panel-overlay'

// Owns nothing of what is displayed — that all lives in SummaryPanelContent, so the investment page
// can mount the same content without inheriting the editor's bottom-anchored collapsible.
export function KosztorysTotalsPanel({
  hasRows,
  availableHeight,
  ...props
}: Omit<ComponentProps<typeof SummaryPanelContent>, 'host'> & {
  hasRows: boolean
  availableHeight: number
}) {
  return (
    <TotalsPanelOverlay hasRows={hasRows} availableHeight={availableHeight}>
      <SummaryPanelContent {...props} host="editor" />
    </TotalsPanelOverlay>
  )
}
