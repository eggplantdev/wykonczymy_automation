import { ASSET_PREVIEW_LABELS } from '@/lib/media/wording'
import type { MediaRemovalLabelsT } from '@/hooks/use-media-removal'
import type { PreviewLabelsT } from '@/types/media'

/**
 * „Bezpowrotnie" is the whole point of the confirm — odznaczenie pliku nie potrzebuje dialogu.
 * Ostatni plik nie dostaje osobnego zdania: „jedyny" nic tu nie zmienia, bo i tak kasujemy jeden.
 */
export const LEAD_ASSET_REMOVAL_LABELS: MediaRemovalLabelsT = {
  confirmOne: 'Usunąć plik ze zgłoszenia?',
  confirmLast: 'Usunąć plik ze zgłoszenia?',
  description: 'Plik zostanie usunięty bezpowrotnie.',
  success: 'Plik usunięty',
  error: 'Nie udało się usunąć pliku',
}

/**
 * The tile carries „usuń" next to „nie przenoś", so the shared „Usuń ten plik" is one word short of
 * saying WHICH side it acts on — the zgłoszenie, not the inwestycja it is being sent to.
 */
export const LEAD_ASSET_PREVIEW_LABELS: PreviewLabelsT = {
  ...ASSET_PREVIEW_LABELS,
  removeOneOfMany: 'Usuń plik ze zgłoszenia',
}

/**
 * Both lead strips render inside a `sm:max-w-lg` dialog. Dwie/trzy kolumny zamiast sześciu, bo po
 * kafelku 75px nie da się poznać, które to zdjęcie — a wybór jest tu całą treścią dialogu.
 * `SIZES` i `GRID` zmieniają się razem: rozjazd nie jest błędem, tylko cichym pobraniem złej
 * rozdzielczości.
 */
export const LEAD_ASSET_STRIP_GRID = 'grid-cols-2 sm:grid-cols-3'
export const LEAD_ASSET_STRIP_SIZES = '(max-width: 767.98px) 45vw, 150px'
