'use client'

import { useEffect, useState } from 'react'
import { CheckboxRow } from '@/components/ui/checkbox-row'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Description } from '@/components/ui/description'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { PLANE_LABELS, RATE_LABELS } from '@/lib/kosztorys/constants'
import { catalogueSavePreviewAction, saveItemToCatalogueAction } from '@/lib/actions/work-catalogue'
import type { CatalogueSavePreviewT } from '@/lib/kosztorys/work-catalogue/types'
import {
  catalogueRateFor,
  catalogueSourceOf,
  type CatalogueRateColumnsT,
} from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { formatRate } from '@/lib/kosztorys/format'
import type { ToolPlaneT } from '@/lib/kosztorys/types'
import { formatPLN } from '@/lib/utils/format-currency'
import { toastMessage } from '@/lib/utils/toast'

const LOAD_FAILED = 'Nie udało się wczytać danych pozycji'

type PricesT = CatalogueRateColumnsT & { clientPrice: number }

const NO_CATEGORY = 'bez kategorii'

// One stawka as one sentence — „auto", a kwota, or the mnożnik with the kwota it comes out to. The
// źródło has to show: 0,65 and 65 zł render the same money on a 100 zł cenie j.m. and mean different
// things the next time that cena moves.
const rateText = (prices: PricesT, plane: ToolPlaneT): string => {
  const rate = catalogueRateFor(prices, plane)
  return formatRate(rate.rate, catalogueSourceOf(rate), rate.coeff)
}

// Rendered for both sides so „nadpisz" is a decision about numbers rather than about a name. An
// EMPTY kategoria is a value like any other — hence `undefined` (not falsiness) hides the row, so
// „bez kategorii" still renders on both sides.
function PriceList({
  title,
  prices,
  category,
}: {
  title: string
  prices: PricesT
  category?: string | null
}) {
  const rows: [string, string, boolean][] = [
    ['Cena j.m.', formatPLN(prices.clientPrice), true],
    [RATE_LABELS.w_tools, rateText(prices, 'w_tools'), true],
    [RATE_LABELS.own_tools, rateText(prices, 'own_tools'), true],
    ...(category !== undefined
      ? ([['Kategoria', category || NO_CATEGORY, false]] as [string, string, boolean][])
      : []),
  ]
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{title}</p>
      {rows.map(([label, value, numeric]) => (
        <div key={label} className="flex justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className={numeric ? 'tabular-nums' : undefined}>{value}</span>
        </div>
      ))}
    </div>
  )
}

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
  const [preview, setPreview] = useState<CatalogueSavePreviewT | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // Deliberately never synced to the preview fetch: the katalog owns its klasyfikacja, so
  // protecting it is the answer until the owner says otherwise.
  const [keepCategory, setKeepCategory] = useState(true)

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

  // The klucz (opis + j.m.) decides it — there is no mode to pick: an occupied klucz can only be
  // overwritten, and a free one can only be created. „Nadpisz" replaces the figures of a row every
  // future kosztorys copies from, and the katalog keeps no history, so that branch asks first.
  const existing = preview?.existing ?? null
  const overwrites = existing != null
  // `|| null`, not `??`: an empty kategoria and a missing one are the same thing to the owner, and
  // the Payload admin can leave `''` in the column where every in-app write folds it to NULL.
  const categoryDiffers =
    existing != null && (existing.category || null) !== (preview?.candidate.category || null)
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
    const res = await saveItemToCatalogueAction(
      itemId,
      overwrites ? 'overwrite' : 'new',
      keepCategory,
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
          description={`Stare stawki przepadną — katalog nie trzyma historii. Cena j.m. ${formatPLN(existing.clientPrice)} → ${formatPLN(preview.candidate.clientPrice)}, ${RATE_LABELS.w_tools.toLowerCase()} ${rateText(existing, 'w_tools')} → ${rateText(preview.candidate, 'w_tools')}, ${PLANE_LABELS.own_tools.toLowerCase()} ${rateText(existing, 'own_tools')} → ${rateText(preview.candidate, 'own_tools')}.${categoryDiffers && !keepCategory ? ` Kategoria w katalogu zmieni się z „${existing.category || NO_CATEGORY}" na „${preview.candidate.category || NO_CATEGORY}".` : ''} Kosztorysy, w których ta praca już siedzi, zostają bez zmian. Jeśli chcesz dodać osobną pozycję zamiast nadpisać tę — anuluj i zmień nazwę pracy w rozpisce.`}
          confirmLabel="Nadpisz"
          pending={saving}
          pendingLabel="Zapisuję…"
          onConfirm={() => void handleSave()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </FormDialogShell>
  )
}
