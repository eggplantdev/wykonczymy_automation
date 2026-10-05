import { POLISH_MEDIA, type TranslatorT } from '@/lib/i18n/translations'
import type { ArchiveCopyT, PreviewLabelsT } from '@/types/media'

export const INVOICE_ARCHIVE_COPY: ArchiveCopyT = { prefix: 'faktury', kind: 'invoice' }

export const FILE_ARCHIVE_COPY: ArchiveCopyT = { prefix: 'pliki', kind: 'file' }

export function buildPreviewLabels(
  archive: ArchiveCopyT,
  { t }: TranslatorT<'media'> = POLISH_MEDIA,
): PreviewLabelsT {
  const shared = { archive, removeOne: t('remove'), preview: t('enlarge') }
  return archive.kind === 'invoice'
    ? {
        ...shared,
        fallbackTitle: t('invoiceFallbackTitle'),
        previewAria: t('invoicePreviewAria'),
        unit: t('invoiceUnit'),
        empty: t('invoiceEmpty'),
        removeOneOfMany: t('invoiceRemoveOneOfMany'),
        removeAll: t('invoiceRemoveAll'),
        add: t('invoiceAdd'),
      }
    : {
        ...shared,
        fallbackTitle: t('fileFallbackTitle'),
        previewAria: t('filePreviewAria'),
        unit: t('fileUnit'),
        empty: t('fileEmpty'),
        removeOneOfMany: t('fileRemoveOneOfMany'),
        removeAll: t('fileRemoveAll'),
        add: t('fileAdd'),
      }
}

/** Shared by every non-invoice strip — a zip of site photos named „faktury-…" is a wrong answer. */
export const ASSET_PREVIEW_LABELS = buildPreviewLabels(FILE_ARCHIVE_COPY)

export const INVOICE_PREVIEW_LABELS = buildPreviewLabels(INVOICE_ARCHIVE_COPY)
