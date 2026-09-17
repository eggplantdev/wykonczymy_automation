'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { Description } from '@/components/ui/description'
import { WorkCatalogueItemForm } from '@/components/forms/work-catalogue-item/work-catalogue-item-form'
import { useWorkCatalogue } from '@/components/kosztorys/editor/dialogs/use-work-catalogue'
import {
  catalogueSavePreviewAction,
  createCatalogueItemAction,
  updateCatalogueItemAction,
} from '@/lib/actions/work-catalogue'
import type { CatalogueSavePreviewT } from '@/lib/kosztorys/work-catalogue/types'
import type { WorkCatalogueItemFormValuesT } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { formatPLNOrAuto } from '@/lib/utils/format-currency'
import { toastMessage } from '@/lib/utils/toast'

const LOAD_FAILED = 'Nie udało się wczytać danych pozycji'

// A rate the rozpiska does not override goes to the cennik as „auto" — the katalog declines to name
// a kwota and the praca prices off the target investment's współczynnik.
const rateValues = (rate: number | null) => ({ auto: rate === null, value: rate?.toString() ?? '' })

function defaultsFrom({
  candidate,
  existing,
}: CatalogueSavePreviewT): WorkCatalogueItemFormValuesT {
  const wTools = rateValues(candidate.wToolsRate)
  const ownTools = rateValues(candidate.ownToolsRate)
  return {
    description: candidate.description,
    // The kategoria is the one field the KATALOG owns rather than the rozpiska: a sekcja is „Podłogi
    // w pokoju 2", a kategoria is how the cennik is browsed. On an overwrite the existing one wins.
    category: existing?.category ?? candidate.category ?? '',
    unit: candidate.unit,
    clientPrice: String(candidate.clientPrice),
    wToolsAuto: wTools.auto,
    wToolsRate: wTools.value,
    ownToolsAuto: ownTools.auto,
    ownToolsRate: ownTools.value,
  }
}

/**
 * „Dodaj do katalogu" / „Edytuj w katalogu" — the SAME form the katalog's own edycja uses, opened
 * with the rozpiska's figures already in the fields. Not a preview with a yes/no: what the cennik
 * gets is a decision (kategoria, j.m., która stawka jest „auto"), and a praca typed into a kosztorys
 * often carries a nazwa or j.m. nobody would want frozen into a global cennik verbatim. The form is
 * also where a missing figure is FILLED IN rather than rejected — the write-it-blind route refused
 * such a praca with an error and left nowhere to fix it.
 */
export function CatalogueItemFromKosztorysDialog({
  itemId,
  open,
  onOpenChange,
  onSaved,
}: {
  itemId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  // Fired on a landed write, so a caller listing this praca can drop it from the list.
  onSaved?: () => void
}) {
  const [preview, setPreview] = useState<CatalogueSavePreviewT | null>(null)
  const { catalogue } = useWorkCatalogue(open)

  useEffect(() => {
    if (!open) return
    let stale = false
    const fail = (message: string) => {
      if (stale) return
      toastMessage(message, 'error', 4000)
      onOpenChange(false)
    }
    void catalogueSavePreviewAction(itemId)
      .then((res) => {
        if (stale) return
        if (!res.success) return fail(res.error ?? LOAD_FAILED)
        setPreview(res.data)
      })
      .catch(() => fail(LOAD_FAILED))
    return () => {
      stale = true
    }
  }, [open, itemId, onOpenChange])

  const existing = preview?.existing ?? null
  const categorySuggestions = [
    ...new Set((catalogue ?? []).map((item) => item.category ?? '')),
  ].filter((category) => category !== '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title={existing ? 'Edytuj pozycję katalogu' : 'Dodaj pracę do katalogu'}
          description={
            existing
              ? 'Ta praca jest już w katalogu pod tą samą nazwą i jednostką — zapis zastąpi jej liczby. Katalog nie trzyma historii. Chcesz osobną pozycję? Zmień nazwę.'
              : 'Katalog prac to wspólny cennik. Stawka bez własnej kwoty idzie jako „auto" i policzy się ze współczynnika inwestycji, do której praca trafi.'
          }
        />
        {/* The old figures as a line rather than a second column of inputs: the fields already hold
            what WILL be saved, and this is the only thing the form cannot show — what is being
            replaced. */}
        {existing && (
          <Description size="xs">
            W katalogu teraz: cena j.m. {formatPLNOrAuto(existing.clientPrice)}, z narzędziami{' '}
            {formatPLNOrAuto(existing.wToolsRate)}, bez narzędzi{' '}
            {formatPLNOrAuto(existing.ownToolsRate)}.
          </Description>
        )}
        {/* `DialogContent` is a `gap-4` column, so this only tops the gap up to the 24px every other
            form dialog puts between its nagłówek and the first field. */}
        <div className="mt-2">
          {!preview ? (
            <Description size="xs">Wczytywanie…</Description>
          ) : (
            <WorkCatalogueItemForm
              formId={`catalogue-item-from-kosztorys-${itemId}`}
              defaultValues={defaultsFrom(preview)}
              categorySuggestions={categorySuggestions}
              // `onSaved` hangs off the WRITE, not off `onSubmitSuccess`: the submit is optimistic,
              // so the success callback fires while the action is still in flight and a caller
              // re-reading there would re-read the state the form was opened on.
              action={async (data) => {
                const res = await (existing
                  ? updateCatalogueItemAction(existing.id, data)
                  : createCatalogueItemAction(data))
                if (res.success) onSaved?.()
                return res
              }}
              successMessage={existing ? 'Pozycja zaktualizowana' : 'Dodano do katalogu'}
              submitLabel={existing ? 'Zapisz' : 'Dodaj'}
              submittingLabel="Zapisywanie..."
              onSubmitSuccess={() => onOpenChange(false)}
              // Snapshot of a live row, same as the katalog's edycja — a restored draft would write
              // back fields the owner never touched.
              persistDraft={false}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
