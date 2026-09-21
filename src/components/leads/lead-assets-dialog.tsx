'use client'

import { useState } from 'react'
import { Paperclip } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MediaStrip } from '@/components/media/media-strip'
import { ASSET_PREVIEW_LABELS } from '@/components/media/preview-labels'
import { useMediaRemoval } from '@/hooks/use-media-removal'
import { attachLeadAssetsAction, removeLeadAssetAction } from '@/lib/actions/lead-assets'
import { LEAD_ASSET_REMOVAL_LABELS, LEAD_ASSET_STRIP_SIZES } from './lead-asset-labels'
import { toastMessage } from '@/lib/utils/toast'
import type { LeadRowT } from '@/types/leads'

const EXCLUDE_LABELS = {
  exclude: 'Nie przenoś tego pliku do inwestycji',
  restore: 'Przywróć ten plik do przeniesienia',
}

/**
 * The zgłoszenie's own files, before and after promotion. Before, it is a viewer with a delete —
 * which files travel is decided in „Utwórz inwestycję". After, it is the second chance for whatever
 * that dialog left behind: the zgłoszenie keeps its relation, so „wszystko albo nic" at promotion
 * time was never the real shape.
 */
export function LeadAssetsDialog({ lead }: { lead: LeadRowT }) {
  const [open, setOpen] = useState(false)
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set())
  const [pending, setPending] = useState(false)

  const { visibleFiles, handleRemove, isRemoving, removalConfirm } = useMediaRemoval({
    files: lead.assets,
    removeOne: (mediaId) => removeLeadAssetAction(lead.id, mediaId),
    labels: LEAD_ASSET_REMOVAL_LABELS,
  })

  if (visibleFiles.length === 0) return '—'

  const isPromoted = lead.investmentId !== null
  const attached = new Set(lead.investmentAssetIds)
  const carried = isPromoted ? visibleFiles.filter((file) => attached.has(file.id)) : []
  const waiting = isPromoted ? visibleFiles.filter((file) => !attached.has(file.id)) : visibleFiles
  const chosenIds = waiting.map((file) => file.id).filter((id) => !excludedIds.has(id))

  function toggleExcluded(mediaId: number) {
    setExcludedIds((current) => {
      const next = new Set(current)
      if (!next.delete(mediaId)) next.add(mediaId)
      return next
    })
  }

  async function attach() {
    setPending(true)
    try {
      const result = await attachLeadAssetsAction(lead.id, chosenIds)
      if (!result.success) {
        toastMessage(result.error ?? 'Nie udało się przenieść plików', 'error')
        return
      }
      toastMessage('Pliki przeniesione do inwestycji', 'success')
      setOpen(false)
    } catch {
      toastMessage('Nie udało się przenieść plików', 'error')
    } finally {
      setPending(false)
    }
  }

  const isBusy = pending || isRemoving

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/* The column header already reads „Załączniki" — repeating it in every cell is noise. */}
        <Button variant="outline" size="xs" aria-label={`Załączniki (${visibleFiles.length})`}>
          <Paperclip />
          {visibleFiles.length}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader
          title="Załączniki zgłoszenia"
          description={
            isPromoted
              ? 'Zgłoszenie zachowuje swoje pliki po utworzeniu inwestycji — stąd przenosisz resztę.'
              : 'Które z nich trafią do inwestycji, wybierasz przy jej tworzeniu.'
          }
        />

        {waiting.length > 0 && (
          <section className="space-y-2">
            {isPromoted && (
              <h3 className="text-sm font-medium">Jeszcze nie w inwestycji ({waiting.length})</h3>
            )}
            <MediaStrip
              files={waiting}
              labels={ASSET_PREVIEW_LABELS}
              sizes={LEAD_ASSET_STRIP_SIZES}
              exclude={
                isPromoted
                  ? {
                      excludedIds,
                      onToggle: (file) => toggleExcluded(file.id),
                      labels: EXCLUDE_LABELS,
                    }
                  : undefined
              }
              onRemove={isBusy ? undefined : handleRemove}
            />
            {isPromoted && (
              <Button
                size="sm"
                onClick={() => void attach()}
                disabled={isBusy || chosenIds.length === 0}
              >
                {pending ? 'Przenoszenie…' : `Przenieś do inwestycji (${chosenIds.length})`}
              </Button>
            )}
          </section>
        )}

        {carried.length > 0 && (
          <section className="mt-4 space-y-2">
            <h3 className="text-muted-foreground text-sm font-medium">
              Już w inwestycji ({carried.length})
            </h3>
            {/* No remove here: the file is the inwestycja's now, and „usuń" on this strip would
                reclaim it from under it. The investment page owns that decision. */}
            <MediaStrip
              files={carried}
              labels={ASSET_PREVIEW_LABELS}
              sizes={LEAD_ASSET_STRIP_SIZES}
            />
          </section>
        )}

        <ConfirmDialog {...removalConfirm} />
      </DialogContent>
    </Dialog>
  )
}
