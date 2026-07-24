'use client'

import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { KosztorysToolbarToggle } from '@/components/kosztorys/kosztorys-toolbar-toggle'
import { KosztorysViewMenu } from '@/components/kosztorys/kosztorys-view-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'
import { useTotalsPanelOpen } from '@/components/kosztorys/use-totals-panel-open'
import { VIEWS, VIEW_LEGEND } from '@/components/kosztorys/kosztorys-toolbar-options'
import { cn } from '@/lib/utils/cn'

export function KosztorysToolbarViewToggles() {
  const { view, setView } = useKosztorysEditorContext()
  const [totalsOpen, setTotalsOpen] = useTotalsPanelOpen()

  return (
    <>
      <KosztorysToolbarToggle
        legend={VIEW_LEGEND}
        options={VIEWS}
        value={view}
        onChange={setView}
        aria-label="Widok cen"
      />
      <KosztorysViewMenu />
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
    </>
  )
}
