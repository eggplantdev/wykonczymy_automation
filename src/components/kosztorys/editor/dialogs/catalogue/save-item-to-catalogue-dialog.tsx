'use client'

import { useState } from 'react'
import { CheckboxRow } from '@/components/ui/checkbox-row'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Description } from '@/components/ui/description'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { saveItemToCatalogueAction } from '@/lib/actions/work-catalogue'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { useCatalogueSavePreview } from './use-catalogue-save-preview'
import {
  categoriesDiffer,
  overwriteSentence,
} from '@/lib/kosztorys/work-catalogue/catalogue-overwrite-text'
import { PriceList } from './catalogue-overwrite-prices'

// „Zapisz do katalogu…" from the row menu. Every figure comes from the server preview — the same
// derivation the save itself runs — so what the dialog shows is what lands in the cennik.
export function SaveItemToCatalogueDialog({
  itemId,
  open,
  onOpenChange,
}: {
  itemId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const preview = useCatalogueSavePreview(itemId, open, onOpenChange)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // Deliberately never synced to the preview fetch: the katalog owns its klasyfikacja, so
  // protecting it is the answer until the owner says otherwise.
  const [keepCategory, setKeepCategory] = useState(true)

  // The server decides it — there is no mode to pick: the remembered praca, or the klucz's holder, can
  // only be updated, and anything else can only be created. An update replaces the figures every
  // szablon and future kosztorys reads, and the katalog keeps no history, so that branch asks first.
  const existing = preview?.existing ?? null
  const leaving = preview?.leaving ?? null
  const templateNames = preview?.templateNames ?? []
  const overwrites = existing != null
  // Updating the praca this pozycja already IS, as opposed to landing on another one by its klucz.
  const updatesOwn = overwrites && leaving == null
  const title = updatesOwn
    ? 'Aktualizuj pozycję w katalogu prac'
    : leaving
      ? 'Zapisz jako nową pracę'
      : 'Zapisz do katalogu…'
  const categoryDiffers =
    existing != null && preview != null && categoriesDiffer(existing, preview.candidate)
  const savedCategory = keepCategory ? existing?.category : preview?.candidate.category

  function requestSave() {
    if (!preview || saving) return
    if (overwrites) return setConfirming(true)
    void handleSave()
  }

  async function handleSave() {
    if (!preview || saving) return
    setConfirming(false)
    setSaving(true)
    const res = await settleAction(() =>
      saveItemToCatalogueAction(itemId, overwrites ? 'overwrite' : 'new', keepCategory),
    )
    setSaving(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się zapisać pracy do katalogu', 'error', 4000)
      return
    }
    toastMessage(overwrites ? 'Zaktualizowano pozycję katalogu' : 'Dodano do katalogu', 'success')
    onOpenChange(false)
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        'Katalog prac to wspólny cennik. Stawka, którą ta pozycja nadpisuje sama, zapisuje się tym samym źródłem — kwotą albo mnożnikiem; stawka bez nadpisania idzie jako „auto” i policzy się ze współczynnika inwestycji, do której praca trafi.'
      }
      confirmLabel={overwrites ? 'Aktualizuj…' : 'Zapisz'}
      onConfirm={requestSave}
      confirmDisabled={!preview || saving}
    >
      {!preview ? (
        <Description size="xs">Wczytywanie…</Description>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium">{preview.candidate.description}</p>
            <p className="text-muted-foreground text-xs">
              {preview.candidate.unit || 'bez jednostki'}
              {/* Only in the create case — on an overwrite the kategoria is a decision made by the
                  „Po zapisie" row below, and repeating the sekcja's here would contradict it. */}
              {!existing && preview.candidate.category ? ` · ${preview.candidate.category}` : ''}
            </p>
          </div>

          {existing && (
            <PriceList
              title="W katalogu"
              prices={existing}
              category={categoryDiffers ? existing.category : undefined}
            />
          )}
          <PriceList
            title={existing ? 'Po zapisie' : 'Do zapisania'}
            prices={preview.candidate}
            category={categoryDiffers ? savedCategory : undefined}
          />

          {categoryDiffers && (
            <CheckboxRow checked={keepCategory} onCheckedChange={setKeepCategory}>
              Zostaw kategorię z katalogu
            </CheckboxRow>
          )}

          {leaving && (
            <Description size="xs">
              Opis albo jednostka różni się od „{leaving.description}” w katalogu, więc to inna
              praca —{' '}
              {existing ? `zapis zaktualizuje „${existing.description}”` : 'zapis doda ją osobno'}.
              „{leaving.description}” zostaje w katalogu bez zmian.
            </Description>
          )}
          {existing && !leaving && (
            <Description size="xs">
              Ta praca jest już w katalogu — zapis zmieni jej liczby. Chcesz osobną pozycję? Zmień
              nazwę pracy w rozpisce i zapisz jeszcze raz.
            </Description>
          )}
          {templateNames.length > 0 && (
            <Description size="xs">
              Zmieni cenę w szablonach: {templateNames.join(', ')}.
            </Description>
          )}
        </>
      )}

      {existing && preview && (
        <ConfirmDialog
          open={confirming}
          title={`Zaktualizować „${existing.description}" w katalogu?`}
          description={`${overwriteSentence(existing, preview.candidate, categoryDiffers && !keepCategory)} Jeśli chcesz dodać osobną pozycję zamiast zmieniać tę — anuluj i zmień nazwę pracy w rozpisce.`}
          confirmLabel="Aktualizuj"
          onConfirm={() => void handleSave()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </FormDialogShell>
  )
}
