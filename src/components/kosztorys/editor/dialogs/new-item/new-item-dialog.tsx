'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { addItemAction } from '@/lib/actions/kosztorys'
import type { KosztorysItemT, NewItemPlacementT } from '@/lib/kosztorys/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { NewItemForm } from './new-item-form'

const FORM_ID = 'new-item'

type LandingT = { placement: NewItemPlacementT; anchorDescription?: string }

const describeLanding = ({ placement, anchorDescription }: LandingT, sectionName: string) =>
  placement.kind === 'end'
    ? `Praca trafi na koniec sekcji „${sectionName}".`
    : `Praca trafi ${placement.dir === 'above' ? 'nad' : 'pod'} „${anchorDescription ?? ''}".`

// With „Nie zamykaj po zapisaniu" the next praca lands under the one just saved, so a run of pracy
// typed in a row keeps its order. An end-of-sekcja placement already does that by itself.
const nextLanding = (landing: LandingT, saved: KosztorysItemT): LandingT =>
  landing.placement.kind === 'end'
    ? landing
    : {
        placement: { kind: 'next-to', anchorItemId: saved.id, dir: 'below' },
        anchorDescription: saved.description ?? '',
      }

/**
 * „Nowa praca" — a praca is created filled, from a form, instead of as a blank row to be typed into.
 * Mounted only while a placement is chosen; the host owns that choice.
 */
export function NewItemDialog({
  placement,
  sectionName,
  anchorDescription,
  workCatalogue,
  kosztorysUnits,
  onPlaced,
  onClose,
}: {
  placement: NewItemPlacementT
  sectionName: string
  anchorDescription?: string
  workCatalogue: readonly WorkCatalogueItemT[]
  kosztorysUnits: readonly string[]
  onPlaced: (item: KosztorysItemT, placement: NewItemPlacementT) => void
  onClose: () => void
}) {
  const [landing, setLanding] = useState<LandingT>({ placement, anchorDescription })
  const keepOpen = useOptimisticFormStore((s) => s.keepOpen)
  const openDialog = useOptimisticFormStore((s) => s.openDialog)
  const closeDialog = useOptimisticFormStore((s) => s.closeDialog)

  // The store's keep-open checkbox is shared by every form dialog; this one is not a `FormDialog`,
  // so it claims and releases the slot itself.
  useEffect(() => {
    openDialog(FORM_ID, true)
    return closeDialog
  }, [openDialog, closeDialog])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader title="Nowa praca" description={describeLanding(landing, sectionName)} />
        {/* `DialogContent` is a `gap-4` column, so this only tops the gap up to the 24px every other
            form dialog puts between its nagłówek and the first field. */}
        <div className="mt-2">
          <NewItemForm
            formId={FORM_ID}
            sectionName={sectionName}
            workCatalogue={workCatalogue}
            kosztorysUnits={kosztorysUnits}
            keepOpen={keepOpen}
            action={async (payload) => {
              const result = await addItemAction({ ...payload, placement: landing.placement })
              if (result.success) {
                onPlaced(result.data.item, landing.placement)
                setLanding(nextLanding(landing, result.data.item))
              }
              return result
            }}
            onSubmitSuccess={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
