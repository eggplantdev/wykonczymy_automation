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
  type CataloguePricesT,
} from '@/lib/kosztorys/work-catalogue/catalogue-overwrite-text'
import { PriceList } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-overwrite-prices'

export type CollisionChoiceT =
  | { kind: 'overwrite'; keepCatalogueCategory: boolean }
  | { kind: 'kosztorys-only' }
  | { kind: 'back' }

export function CatalogueCollisionConfirm({
  existing,
  candidate,
  allowKosztorysOnly,
  onChoose,
}: {
  existing: WorkCatalogueItemT
  candidate: CataloguePricesT & { category: string }
  allowKosztorysOnly: boolean
  onChoose: (choice: CollisionChoiceT) => void
}) {
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
          {allowKosztorysOnly && (
            <Button variant="outline" onClick={() => onChoose({ kind: 'kosztorys-only' })}>
              Tylko do kosztorysu
            </Button>
          )}
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
