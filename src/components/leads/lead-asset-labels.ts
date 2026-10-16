import { ASSET_PREVIEW_LABELS } from '@/lib/media/wording'
import type { MediaRemovalLabelsT } from '@/hooks/use-media-removal'
import type { PreviewLabelsT } from '@/types/media'

export const LEAD_ASSET_REMOVAL_LABELS: MediaRemovalLabelsT = {
  confirmOne: 'Usunąć plik ze zgłoszenia?',
  confirmLast: 'Usunąć plik ze zgłoszenia?',
  description: 'Plik zostanie usunięty bezpowrotnie.',
  success: 'Plik usunięty',
  error: 'Nie udało się usunąć pliku',
}

export const LEAD_ASSET_PREVIEW_LABELS: PreviewLabelsT = {
  ...ASSET_PREVIEW_LABELS,
  removeOneOfMany: 'Usuń plik ze zgłoszenia',
}

/**
 * `SIZES` i `GRID` zmieniają się razem: rozjazd nie jest błędem, tylko cichym pobraniem złej
 * rozdzielczości.
 */
export const LEAD_ASSET_STRIP_GRID = 'grid-cols-2 sm:grid-cols-3'
export const LEAD_ASSET_STRIP_SIZES = '(max-width: 767.98px) 45vw, 150px'
