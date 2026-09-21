import type { PreviewLabelsT } from '@/components/dialogs/invoice-preview-dialog'

/** Shared by every non-invoice strip — a zip of site photos named „faktury-…" is a wrong answer. */
export const ASSET_PREVIEW_LABELS: PreviewLabelsT = {
  fallbackTitle: 'Plik',
  empty: 'Brak plików do wyświetlenia.',
  archivePrefix: 'pliki',
  removeOne: 'Usuń',
  removeOneOfMany: 'Usuń ten plik',
  removeAll: 'Usuń wszystkie',
  add: 'Dodaj kolejne',
}
