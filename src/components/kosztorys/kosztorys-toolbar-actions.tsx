'use client'

import { Button } from '@/components/ui/button'
import { KosztorysActionsMenu } from '@/components/kosztorys/kosztorys-actions-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'

export function KosztorysToolbarActions() {
  const { investmentId, onOpenVersions, summaryOpen, setSummaryOpen } = useKosztorysEditorContext()

  return (
    <div className="ml-auto flex items-center gap-1">
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
