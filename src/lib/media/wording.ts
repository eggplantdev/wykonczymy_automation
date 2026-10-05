import type { ArchiveCopyT, PreviewLabelsT } from '@/types/media'

export const INVOICE_ARCHIVE_COPY: ArchiveCopyT = { prefix: 'faktury', kind: 'invoice' }

export const FILE_ARCHIVE_COPY: ArchiveCopyT = { prefix: 'pliki', kind: 'file' }

/** Shared by every non-invoice strip — a zip of site photos named „faktury-…" is a wrong answer. */
export const ASSET_PREVIEW_LABELS: PreviewLabelsT = {
  fallbackTitle: 'Plik',
  previewAria: 'Podgląd pliku',
  unit: 'plik',
  empty: 'Brak plików do wyświetlenia.',
  archive: FILE_ARCHIVE_COPY,
  removeOne: 'Usuń',
  removeOneOfMany: 'Usuń ten plik',
  preview: 'Powiększ',
  removeAll: 'Usuń wszystkie',
  add: 'Dodaj kolejne',
}

export const INVOICE_PREVIEW_LABELS: PreviewLabelsT = {
  fallbackTitle: 'Faktura',
  previewAria: 'Podgląd faktury',
  unit: 'strona',
  empty: 'Brak stron do wyświetlenia.',
  archive: INVOICE_ARCHIVE_COPY,
  removeOne: 'Usuń',
  removeOneOfMany: 'Usuń stronę',
  preview: 'Powiększ',
  removeAll: 'Usuń całą fakturę',
  add: 'Dodaj stronę',
}
