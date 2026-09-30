'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox-row'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import {
  categoriesDiffer,
  overwriteSentence,
  PriceList,
  type CataloguePricesT,
} from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-overwrite-prices'

export type CollisionChoiceT =
  | { kind: 'overwrite'; keepCatalogueCategory: boolean }
  | { kind: 'kosztorys-only' }
  | { kind: 'back' }

// Three outcomes, not ConfirmDialog's two: the owner ruled (2026-09-30) that a praca whose opis + j.m.
// already sits in the katalog must still be addable to the kosztorys without touching the cennik —
// „nie" to the overwrite is not „nie" to the praca. Mounted per question, so the kategoria toggle
// starts on every time.
export function CatalogueCollisionConfirm({
  existing,
  candidate,
  onChoose,
}: {
  existing: WorkCatalogueItemT
  candidate: CataloguePricesT & { category: string }
  onChoose: (choice: CollisionChoiceT) => void
}) {
  // The katalog owns its klasyfikacja, so protecting it is the default.
  const [keepCategory, setKeepCategory] = useState(true)
  const categoryDiffers = categoriesDiffer(existing, candidate)
  const back = () => onChoose({ kind: 'back' })

  return (
    <AlertDialog open onOpenChange={(next) => !next && back()}>
      <AlertDialogContent onOverlayClick={back} className="max-w-md">
        <div className="flex flex-col gap-2">
          <AlertDialogTitle>{`„${existing.description}" jest już w katalogu`}</AlertDialogTitle>
          <AlertDialogDescription>
            {overwriteSentence(existing, candidate, categoryDiffers && !keepCategory)}
          </AlertDialogDescription>
        </div>

        <div className="mt-4 space-y-3">
          <PriceList
            title="W katalogu"
            prices={existing}
            category={categoryDiffers ? existing.category : undefined}
          />
          <PriceList
            title="Po nadpisaniu"
            prices={candidate}
            category={
              categoryDiffers ? (keepCategory ? existing.category : candidate.category) : undefined
            }
          />
          {categoryDiffers && (
            <CheckboxRow checked={keepCategory} onCheckedChange={setKeepCategory}>
              Zostaw kategorię z katalogu
            </CheckboxRow>
          )}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={back}>
            Wróć
          </Button>
          <Button variant="outline" onClick={() => onChoose({ kind: 'kosztorys-only' })}>
            Tylko do kosztorysu
          </Button>
          <Button
            variant="destructive"
            onClick={() => onChoose({ kind: 'overwrite', keepCatalogueCategory: keepCategory })}
          >
            Nadpisz w katalogu
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
