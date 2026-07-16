'use client'

import { Button } from '@/components/ui/button'
import { ColumnToggleMenu } from '@/components/ui/column-toggle-menu'
import { KosztorysActionsMenu } from '@/components/kosztorys/kosztorys-actions-menu'
import { KosztorysProgressCounter } from '@/components/kosztorys/kosztorys-progress-counter'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'

export function KosztorysToolbarActions() {
  const {
    doneNet,
    totalNet,
    tree,
    moneyAxis,
    investmentId,
    onOpenVersions,
    columnToggleItems,
    toggleColumn,
    summaryOpen,
    setSummaryOpen,
  } = useKosztorysEditorContext()

  return (
    <div className="ml-auto flex items-center gap-1">
      {/* Whole-kosztorys progress at the active price view, both netto — the counter applies the axis. */}
      <KosztorysProgressCounter
        doneNet={doneNet}
        totalNet={totalNet}
        vatRate={tree.vatRate}
        moneyAxis={moneyAxis}
      />
      <KosztorysActionsMenu investmentId={investmentId} onOpenVersions={onOpenVersions} />
      {/* ml-0: the picker's default ml-auto is for flat toolbars — this group is already
          floated right. */}
      <ColumnToggleMenu items={columnToggleItems} onToggle={toggleColumn} className="ml-0" />
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
