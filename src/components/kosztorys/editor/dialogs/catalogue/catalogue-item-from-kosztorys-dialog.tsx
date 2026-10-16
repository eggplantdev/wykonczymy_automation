'use client'

import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { Description } from '@/components/ui/description'
import { WorkCatalogueItemForm } from '@/components/forms/work-catalogue-item/work-catalogue-item-form'
import { createCatalogueItemAction, updateCatalogueItemAction } from '@/lib/actions/work-catalogue'
import { translationTexts } from '@/lib/i18n/description-translations'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import { catalogueCategorySuggestions } from '@/lib/kosztorys/work-catalogue/category-options'
import type {
  CatalogueSavePreviewT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import {
  rateFormValues,
  type WorkCatalogueItemFormValuesT,
} from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { catalogueRateText } from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { formatPLN } from '@/lib/utils/format-currency'
import { useCatalogueSavePreview } from './use-catalogue-save-preview'

const translationBaselineOf = ({ candidate, existing }: CatalogueSavePreviewT) =>
  existing?.descriptionTranslations ?? candidate.descriptionTranslations

function defaultsFrom(preview: CatalogueSavePreviewT): WorkCatalogueItemFormValuesT {
  const { candidate, existing } = preview
  return {
    description: candidate.description,
    category: existing?.category ?? candidate.category ?? '',
    unit: candidate.unit,
    clientPrice: String(candidate.clientPrice),
    ...rateFormValues(candidate),
    translations: translationTexts(translationBaselineOf(preview)),
    // From the stored entry, never the candidate: a rozpiska row has no comment, and an overwrite
    // seeded blank would clear the one already in the katalog.
    workNote: existing?.workNote ?? '',
  }
}

export function CatalogueItemFromKosztorysDialog({
  itemId,
  catalogue,
  open,
  onOpenChange,
}: {
  itemId: number
  catalogue: readonly WorkCatalogueItemT[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const preview = useCatalogueSavePreview(itemId, open, onOpenChange)

  const existing = preview?.existing ?? null
  const categorySuggestions = catalogueCategorySuggestions(catalogue)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title={existing ? 'Edytuj pozycję katalogu' : 'Dodaj pracę do katalogu'}
          description={
            existing
              ? 'Ta praca jest już w katalogu pod tą samą nazwą i jednostką — zapis zastąpi jej liczby. Katalog nie trzyma historii. Chcesz osobną pozycję? Zmień nazwę.'
              : 'Katalog prac to wspólny cennik. Stawka bez własnego źródła idzie jako „auto" i policzy się ze współczynnika inwestycji, do której praca trafi; mnożnik przeliczy się od jej ceny j.m.'
          }
        />
        {existing && (
          <Description size="xs">
            W katalogu teraz: cena j.m. {formatPLN(existing.clientPrice)},{' '}
            {PLANE_LABELS.w_tools.toLowerCase()} {catalogueRateText(existing, 'w_tools')},{' '}
            {PLANE_LABELS.own_tools.toLowerCase()} {catalogueRateText(existing, 'own_tools')}.
          </Description>
        )}
        <div className="mt-2">
          {!preview ? (
            <Description size="xs">Wczytywanie…</Description>
          ) : (
            <WorkCatalogueItemForm
              formId={`catalogue-item-from-kosztorys-${itemId}`}
              defaultValues={defaultsFrom(preview)}
              translationBaseline={translationBaselineOf(preview)}
              categorySuggestions={categorySuggestions}
              action={(data) =>
                existing
                  ? updateCatalogueItemAction(existing.id, data)
                  : createCatalogueItemAction(data)
              }
              successMessage={existing ? 'Pozycja zaktualizowana' : 'Dodano do katalogu'}
              submitLabel={existing ? 'Zapisz' : 'Dodaj'}
              submittingLabel="Zapisywanie..."
              onSubmitSuccess={() => onOpenChange(false)}
              // Snapshot of a live row — a restored draft would write
              // back fields the owner never touched.
              persistDraft={false}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
