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
import { categoriesDiffer, overwriteSentence, PriceList } from './catalogue-overwrite-prices'

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

  // The klucz (opis + j.m.) decides it — there is no mode to pick: an occupied klucz can only be
  // overwritten, and a free one can only be created. „Nadpisz" replaces the figures of a row every
  // future kosztorys copies from, and the katalog keeps no history, so that branch asks first.
  const existing = preview?.existing ?? null
  const overwrites = existing != null
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
    toastMessage(overwrites ? 'Nadpisano pozycję katalogu' : 'Dodano do katalogu', 'success')
    onOpenChange(false)
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Zapisz do katalogu…"
      description={
        'Katalog prac to wspólny cennik. Stawka, którą ta pozycja nadpisuje sama, zapisuje się tym samym źródłem — kwotą albo mnożnikiem; stawka bez nadpisania idzie jako „auto” i policzy się ze współczynnika inwestycji, do której praca trafi.'
      }
      confirmLabel={overwrites ? 'Nadpisz…' : 'Zapisz'}
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

          {existing && (
            <Description size="xs">
              Ta praca jest już w katalogu pod tą samą nazwą i jednostką — zapis ją nadpisze. Chcesz
              osobną pozycję? Zmień nazwę pracy w rozpisce i zapisz jeszcze raz.
            </Description>
          )}
        </>
      )}

      {existing && preview && (
        <ConfirmDialog
          open={confirming}
          title={`Nadpisać „${existing.description}" w katalogu?`}
          description={`${overwriteSentence(existing, preview.candidate, categoryDiffers && !keepCategory)} Jeśli chcesz dodać osobną pozycję zamiast nadpisać tę — anuluj i zmień nazwę pracy w rozpisce.`}
          confirmLabel="Nadpisz"
          onConfirm={() => void handleSave()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </FormDialogShell>
  )
}
