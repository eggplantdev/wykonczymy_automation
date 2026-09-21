'use client'

import { useState } from 'react'
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
 * The second chance for a file the promotion dialog left behind. A zgłoszenie keeps its own copy of
 * the relation after promotion, so „wszystko albo nic" at promotion time was never the real shape —
 * this is where the rest goes across, one batch at a time.
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

  const attached = new Set(lead.investmentAssetIds)
  const carried = visibleFiles.filter((file) => attached.has(file.id))
  const waiting = visibleFiles.filter((file) => !attached.has(file.id))
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
        <Button variant="outline" size="sm">
          Pliki ({visibleFiles.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader
          title="Pliki zgłoszenia"
          description="Zgłoszenie zachowuje swoje pliki po utworzeniu inwestycji — stąd przenosisz resztę."
        />

        {waiting.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Jeszcze nie w inwestycji ({waiting.length})</h3>
            <MediaStrip
              files={waiting}
              labels={ASSET_PREVIEW_LABELS}
              sizes={LEAD_ASSET_STRIP_SIZES}
              exclude={{
                excludedIds,
                onToggle: (file) => toggleExcluded(file.id),
                labels: EXCLUDE_LABELS,
              }}
              onRemove={isBusy ? undefined : handleRemove}
            />
            <Button
              size="sm"
              onClick={() => void attach()}
              disabled={isBusy || chosenIds.length === 0}
            >
              {pending ? 'Przenoszenie…' : `Przenieś do inwestycji (${chosenIds.length})`}
            </Button>
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
