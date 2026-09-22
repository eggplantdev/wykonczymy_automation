import type { PreviewLabelsT } from '@/types/media'

/** Shared by every non-invoice strip — a zip of site photos named „faktury-…" is a wrong answer. */
export const ASSET_PREVIEW_LABELS: PreviewLabelsT = {
  fallbackTitle: 'Plik',
  empty: 'Brak plików do wyświetlenia.',
  archivePrefix: 'pliki',
  removeOne: 'Usuń',
  removeOneOfMany: 'Usuń ten plik',
  preview: 'Powiększ',
  removeAll: 'Usuń wszystkie',
  add: 'Dodaj kolejne',
}

export const INVOICE_PREVIEW_LABELS: PreviewLabelsT = {
  fallbackTitle: 'Faktura',
  empty: 'Brak stron do wyświetlenia.',
  archivePrefix: 'faktury',
  removeOne: 'Usuń',
  removeOneOfMany: 'Usuń stronę',
  preview: 'Powiększ',
  removeAll: 'Usuń całą fakturę',
  add: 'Dodaj stronę',
}
