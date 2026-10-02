'use client'

import { useLoadOnOpen } from '@/components/kosztorys/editor/hooks/use-load-on-open'
import { catalogueSavePreview } from '@/lib/queries/catalogue-save-preview'

const LOAD_FAILED = 'Nie udało się wczytać danych pozycji'

export function useCatalogueSavePreview(
  itemId: number,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  return useLoadOnOpen(catalogueSavePreview, itemId, open, onOpenChange, LOAD_FAILED)
}
