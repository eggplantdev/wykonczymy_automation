import type { MediaRemovalLabelsT } from '@/hooks/use-media-removal'

/** „Bezpowrotnie" is the whole point of the confirm — excluding a file needs no dialog at all. */
export const LEAD_ASSET_REMOVAL_LABELS: MediaRemovalLabelsT = {
  confirmOne: 'Czy na pewno chcesz usunąć ten plik ze zgłoszenia?',
  confirmLast: 'Czy na pewno chcesz usunąć ten plik? To jedyny plik tego zgłoszenia.',
  description: 'Operacji nie da się cofnąć — plik znika ze zgłoszenia bezpowrotnie.',
  success: 'Plik usunięty',
  error: 'Nie udało się usunąć pliku',
}

/** Both lead strips render inside a `sm:max-w-lg` dialog, on the same 3/4/6-column grid. */
export const LEAD_ASSET_STRIP_SIZES =
  '(max-width: 767.98px) 31vw, (max-width: 1023.98px) 110px, 75px'
