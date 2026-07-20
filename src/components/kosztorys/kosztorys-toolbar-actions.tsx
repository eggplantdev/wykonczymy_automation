'use client'

import Link from 'next/link'
import { Eye, Redo2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KosztorysActionsMenu } from '@/components/kosztorys/kosztorys-actions-menu'
import { KosztorysShareDialog } from '@/components/kosztorys/kosztorys-share-dialog'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'
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

  return (
    <div className="ml-auto flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={undo}
        disabled={!canUndo}
        title="Cofnij (Cmd/Ctrl+Z)"
        aria-label="Cofnij"
      >
        <Undo2 />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={redo}
        disabled={!canRedo}
        title="Ponów (Cmd/Ctrl+Shift+Z)"
        aria-label="Ponów"
      >
        <Redo2 />
      </Button>
      {/* Always available, independent of whether a link is currently shared — the owner needs to see
          what a client would see before deciding to share, and after revoking. */}
      <Button size="sm" variant="outline" asChild title="Widok klienta">
        <Link href={`/podglad-klienta/${investmentId}`} target="_blank">
          <Eye />
          Widok klienta
        </Link>
      </Button>
      <KosztorysShareDialog investmentId={investmentId} />
      <KosztorysActionsMenu investmentId={investmentId} onOpenVersions={onOpenVersions} />
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
    </div>
  )
}
