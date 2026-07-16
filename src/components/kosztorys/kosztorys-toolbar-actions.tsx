'use client'

import { Button } from '@/components/ui/button'
import { KosztorysActionsMenu } from '@/components/kosztorys/kosztorys-actions-menu'
import { KosztorysProgressCounter } from '@/components/kosztorys/kosztorys-progress-counter'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'

export function KosztorysToolbarActions() {
  const {
    totalNet,
    totalPlannedNet,
    tree,
    moneyAxis,
    investmentId,
    onOpenVersions,
    summaryOpen,
    setSummaryOpen,
  } = useKosztorysEditorContext()

  return (
    <div className="ml-auto flex items-center gap-1">
      {/* Whole-kosztorys progress at the active price view, both netto — the counter applies the axis. */}
      <KosztorysProgressCounter
        doneNet={totalNet}
        plannedNet={totalPlannedNet}
        vatRate={tree.vatRate}
        moneyAxis={moneyAxis}
      />
      <KosztorysActionsMenu investmentId={investmentId} onOpenVersions={onOpenVersions} />
      <Button
        size="sm"
        variant={summaryOpen ? 'default' : 'outline'}
        onClick={() => setSummaryOpen((o) => !o)}
      >
        Sekcje
      </Button>
    </div>
  )
}
