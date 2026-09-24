'use client'

import { listWorkCatalogue } from '@/lib/queries/list-work-catalogue'
import { useListOnOpen } from '@/components/kosztorys/editor/dialogs/use-list-on-open'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

export function useWorkCatalogue(open: boolean) {
  const { items, reset } = useListOnOpen<WorkCatalogueItemT>(
    open,
    listWorkCatalogue,
    'Nie udało się wczytać katalogu prac',
  )
  return { catalogue: items, resetCatalogue: reset }
}
