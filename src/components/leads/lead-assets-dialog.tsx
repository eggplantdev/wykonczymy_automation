'use client'

import { useEffect, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MediaStrip } from '@/components/media/media-strip'
import { ASSET_PREVIEW_LABELS } from '@/components/media/preview-labels'
import { SimpleSelect } from '@/components/ui/simple-select'
import { useMediaRemoval } from '@/hooks/use-media-removal'
import { attachLeadAssetsAction, removeLeadAssetAction } from '@/lib/actions/lead-assets'
import { investmentAssetIdsAction } from '@/lib/actions/investment-assets'
import { LEAD_ASSET_REMOVAL_LABELS, LEAD_ASSET_STRIP_SIZES } from './lead-asset-labels'
import { toastMessage } from '@/lib/utils/toast'
import type { LeadRowT } from '@/types/leads'

const EXCLUDE_LABELS = {
  exclude: 'Nie przenoś tego pliku do inwestycji',
  restore: 'Przywróć ten plik do przeniesienia',
}

export type InvestmentOptionT = { id: number; name: string }

type PropsT = { lead: LeadRowT; investments: InvestmentOptionT[] }

/**
 * The zgłoszenie's own files: a viewer with a delete, plus the way to send any of them into any
 * inwestycja. The zgłoszenie keeps its relation after promotion, so „wszystko albo nic" at promotion
 * time was never the real shape — and the target is picked here rather than fixed to the zgłoszenie's
 * own inwestycja, because a file attached to the wrong one cannot be un-attached from this side.
 */
export function LeadAssetsDialog({ lead, investments }: PropsT) {
  const [open, setOpen] = useState(false)
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set())
  const [pending, setPending] = useState(false)
  const [targetId, setTargetId] = useState(
    lead.investmentId === null ? '' : String(lead.investmentId),
  )
  // `null` = we don't know yet what the target holds, so the split is withheld rather than guessed.
  const [attachedIds, setAttachedIds] = useState<Set<number> | null>(null)

  const target = targetId === '' ? null : Number(targetId)

  const { visibleFiles, handleRemove, isRemoving, removalConfirm } = useMediaRemoval({
    files: lead.assets,
    removeOne: (mediaId) => removeLeadAssetAction(lead.id, mediaId),
    labels: LEAD_ASSET_REMOVAL_LABELS,
  })

  const ownInvestmentId = lead.investmentId
  const ownAssetIds = lead.investmentAssetIds

  useEffect(() => {
    if (!open || target === null) {
      setAttachedIds(null)
      return
    }
    // The row already carries this for the zgłoszenie's own inwestycja — only a freely picked
    // target is worth a round-trip.
    if (target === ownInvestmentId) {
      setAttachedIds(new Set(ownAssetIds))
      return
    }

    let cancelled = false
    setAttachedIds(null)
    void investmentAssetIdsAction(target).then((result) => {
      if (cancelled || !result.success) return
      setAttachedIds(new Set(result.data))
    })
    return () => {
      cancelled = true
    }
  }, [open, target, ownInvestmentId, ownAssetIds])

  if (visibleFiles.length === 0) return '—'

  const carried = attachedIds ? visibleFiles.filter((file) => attachedIds.has(file.id)) : []
  const waiting = attachedIds
    ? visibleFiles.filter((file) => !attachedIds.has(file.id))
    : visibleFiles
  const chosenIds = waiting.map((file) => file.id).filter((id) => !excludedIds.has(id))

  function toggleExcluded(mediaId: number) {
    setExcludedIds((current) => {
      const next = new Set(current)
      if (!next.delete(mediaId)) next.add(mediaId)
      return next
    })
  }

  async function attach() {
    if (target === null) return
    setPending(true)
    try {
      const result = await attachLeadAssetsAction(lead.id, target, chosenIds)
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
        {/* The column header already reads „Załączniki" — repeating it in every cell is noise. The
            min-width keeps a 1-digit and a 2-digit count the same size down the column. */}
        <Button
          variant="outline"
          size="xs"
          className="min-w-12"
          aria-label={`Załączniki (${visibleFiles.length})`}
        >
          <Paperclip />
          {visibleFiles.length}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader
          title="Załączniki zgłoszenia"
          description="Zgłoszenie zachowuje swoje pliki — stąd przenosisz je do wybranej inwestycji."
        />

        <div className="space-y-2">
          <p className="text-sm font-medium">Inwestycja docelowa</p>
          {investments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Brak inwestycji do wyboru.</p>
          ) : (
            <SimpleSelect
              value={targetId}
              onValueChange={setTargetId}
              disabled={isBusy}
              placeholder="Wybierz inwestycję…"
              options={investments.map((investment) => ({
                value: String(investment.id),
                label: investment.name,
              }))}
            />
          )}
        </div>

        {waiting.length > 0 && (
          <section className="space-y-2">
            {carried.length > 0 && (
              <h3 className="text-sm font-medium">Jeszcze nie w inwestycji ({waiting.length})</h3>
            )}
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
              disabled={isBusy || target === null || chosenIds.length === 0}
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
            {/* No delete here: this strip is about the target, and „usuń" on it would detach the
                file from the ZGŁOSZENIE instead — the inwestycja's own page owns that decision. */}
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
