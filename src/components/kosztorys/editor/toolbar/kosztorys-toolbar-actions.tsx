'use client'

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KosztorysActionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'
import { cn } from '@/lib/utils/cn'

export function KosztorysToolbarActions() {
  const {
    investmentId,
    onOpenVersions,
    summaryOpen,
    setSummaryOpen,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useKosztorysEditorContext()
  const [totalsOpen, setTotalsOpen] = useTotalsPanelOpen()

  return (
    <div className="ml-auto flex items-center gap-1">
      <KosztorysActionsMenu
        investmentId={investmentId}
        onOpenVersions={onOpenVersions}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <Button
        size="sm"
        variant={summaryOpen ? 'default' : 'outline'}
        // default has no border, outline does — keep the box identical so toggling doesn't shift the
        // right-aligned neighbour by the border's width.
        className={cn(summaryOpen && 'border border-transparent')}
        onClick={() => setSummaryOpen((o) => !o)}
      >
        Sekcje
      </Button>
      <Button
        size="sm"
        variant={totalsOpen ? 'default' : 'outline'}
        className={cn(totalsOpen && 'border border-transparent')}
        onClick={() => setTotalsOpen(!totalsOpen)}
      >
        <ChevronDown
          className={cn('transition-transform duration-200', totalsOpen && 'rotate-180')}
        />
        Podsumowanie
      </Button>
    </div>
  )
}
