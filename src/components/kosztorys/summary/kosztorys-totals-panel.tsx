'use client'

import { type ComponentProps } from 'react'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import { TotalsPanelOverlay } from '@/components/kosztorys/summary/totals-panel-overlay'

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
