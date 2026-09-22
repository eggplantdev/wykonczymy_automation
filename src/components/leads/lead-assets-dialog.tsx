'use client'

import { useEffect, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MediaStrip } from '@/components/media/media-strip'
import { SearchSelect } from '@/components/ui/search-select'
import { ActiveFilterLabel } from '@/components/filters/active-filter-label'
import { useMediaRemoval } from '@/hooks/use-media-removal'
import { attachLeadAssetsAction, removeLeadAssetAction } from '@/lib/actions/lead-assets'
import { getInvestmentAssetIds } from '@/lib/queries/investment-asset-ids'
import {
  LEAD_ASSET_PREVIEW_LABELS,
  LEAD_ASSET_STRIP_GRID,
  LEAD_ASSET_REMOVAL_LABELS,
  LEAD_ASSET_STRIP_SIZES,
} from './lead-asset-labels'
import { toastMessage } from '@/lib/utils/toast'
import { activeOrSelected } from '@/lib/utils/is-active-ref'
import type { LeadRowT } from '@/types/leads'

const PICK_LABEL = 'Dodaj to zdjęcie do inwestycji'

export type InvestmentOptionT = { id: number; name: string; active?: boolean }

type PropsT = { lead: LeadRowT; investments: InvestmentOptionT[] }

/**
 * The zgłoszenie's own files: a viewer with a delete, plus the way to send any of them into any
 * inwestycja. The zgłoszenie keeps its relation after promotion, so „wszystko albo nic" at promotion
 * time was never the real shape — and the target is picked here rather than fixed to the zgłoszenie's
 * own inwestycja, because a file attached to the wrong one cannot be un-attached from this side.
 */
export function LeadAssetsDialog({ lead, investments }: PropsT) {
  const [open, setOpen] = useState(false)
  // Opt-in: sending a file into somebody else's inwestycja cannot be undone from this side, so
  // nothing is ticked on the user's behalf.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pending, setPending] = useState(false)
  const [activeOnly, setActiveOnly] = useState(true)
  const [targetId, setTargetId] = useState(
    lead.investmentId === null ? '' : String(lead.investmentId),
  )
  // `null` = we don't know yet what the target holds, so the split is withheld rather than guessed.
  const [attachedIds, setAttachedIds] = useState<Set<number> | null>(null)

  const target = targetId === '' ? null : Number(targetId)
  const options = activeOrSelected(investments, activeOnly, targetId)

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
    void getInvestmentAssetIds(target).then((result) => {
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
  const chosenIds = waiting.map((file) => file.id).filter((id) => selectedIds.has(id))
  const allPicked = waiting.length > 0 && chosenIds.length === waiting.length

  function togglePicked(mediaId: number) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (!next.delete(mediaId)) next.add(mediaId)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds(allPicked ? new Set() : new Set(waiting.map((file) => file.id)))
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
          title="Załączniki"
          description="Wybierz pliki i inwestycję, do której będą dodane."
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Inwestycja docelowa</p>
            <ActiveFilterLabel activeOnly={activeOnly} onToggle={setActiveOnly} />
          </div>
          {options.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {investments.length === 0
                ? 'Brak inwestycji do wyboru.'
                : 'Brak aktywnych inwestycji'}
            </p>
          ) : (
            <SearchSelect
              value={targetId}
              onChange={setTargetId}
              disabled={isBusy}
              placeholder="Wybierz inwestycję"
              searchPlaceholder="Szukaj inwestycji..."
              emptyMessage="Nie znaleziono inwestycji."
              items={options.map((investment) => ({
                value: String(investment.id),
                label: investment.name,
              }))}
            />
          )}
        </div>

        {waiting.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">
                {carried.length > 0
                  ? `Jeszcze nie w inwestycji (${waiting.length})`
                  : `Wybierz pliki (${waiting.length})`}
              </h3>
              <Button type="button" variant="ghost" size="xs" onClick={toggleAll}>
                {allPicked ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
              </Button>
            </div>
            <MediaStrip
              files={waiting}
              labels={LEAD_ASSET_PREVIEW_LABELS}
              sizes={LEAD_ASSET_STRIP_SIZES}
              gridClassName={LEAD_ASSET_STRIP_GRID}
              pick={{
                selectedIds,
                onToggle: (file) => togglePicked(file.id),
                label: PICK_LABEL,
              }}
              onRemove={isBusy ? undefined : handleRemove}
            />
            <Button
              size="sm"
              onClick={() => void attach()}
              disabled={isBusy || target === null || chosenIds.length === 0}
            >
              {pending ? 'Dodawanie…' : `Dodaj do inwestycji (${chosenIds.length})`}
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
              labels={LEAD_ASSET_PREVIEW_LABELS}
              sizes={LEAD_ASSET_STRIP_SIZES}
              gridClassName={LEAD_ASSET_STRIP_GRID}
            />
          </section>
        )}

        <ConfirmDialog {...removalConfirm} />
      </DialogContent>
    </Dialog>
  )
}
