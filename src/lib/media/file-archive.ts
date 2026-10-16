import { POLISH_MEDIA, type TranslatorT } from '@/lib/i18n/translations'
import { splitExtension } from '@/lib/utils/append-short-id'
import type { ArchiveCopyT, PreviewFileT } from '@/types/media'

export type ArchiveRowT = {
  date: string
  description: string | null
  invoices: PreviewFileT[]
}

export type ArchiveFileT = {
  url: string
  name: string
}

/**
 * Flattening up front is what keeps the batch size bounding concurrent *fetches*: six rows of three
 * pages each would otherwise fire eighteen requests at once.
 */
export function flattenArchiveRows(rows: ArchiveRowT[]): ArchiveFileT[] {
  const usedNames = new Set<string>()
  return rows.flatMap((row) =>
    row.invoices.map((invoice) => ({
      url: invoice.url,
      name: buildUniqueFilename(row.date, row.description ?? '', invoice.filename, usedNames),
    })),
  )
}

export function buildUniqueFilename(
  date: string,
  description: string,
  originalFilename: string | null,
  usedNames: Set<string>,
): string {
  const dateStr = date.slice(0, 10).replace(/-/g, '')
  const safeDesc = sanitizeForFilename(description).slice(0, 40)
  const { ext } = splitExtension(originalFilename ?? '')
  return dedupeFilename(`${dateStr}_${safeDesc}${ext}`, usedNames)
}

export function dedupeFilename(candidate: string, usedNames: Set<string>): string {
  const { base, ext } = splitExtension(candidate)

  let name = candidate
  let counter = 1
  while (usedNames.has(name)) {
    name = `${base}_${counter}${ext}`
    counter++
  }

  usedNames.add(name)
  return name
}

export function sanitizeForFilename(str: string): string {
  return str
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

type ArchiveTallyT = {
  rows: number
  rowsWithFile: number
  expectedFiles: number
  downloadedFiles: number
}

export function buildArchiveMessage(
  { rows, rowsWithFile, expectedFiles, downloadedFiles }: ArchiveTallyT,
  { kind }: ArchiveCopyT,
  { t, tp }: TranslatorT<'media'> = POLISH_MEDIA,
): string {
  const isInvoice = kind === 'invoice'
  if (rowsWithFile === 0) return t(isInvoice ? 'noInvoicesToDownload' : 'noFilesToDownload')
  if (downloadedFiles === 0) return t(isInvoice ? 'noInvoiceDownloaded' : 'noFileDownloaded')

  const missingRows = rows - rowsWithFile
  const failedFiles = expectedFiles - downloadedFiles
  if (missingRows === 0 && failedFiles === 0) {
    return tp(isInvoice ? 'invoicesDownloaded' : 'filesDownloaded', downloadedFiles)
  }

  const reasons: string[] = []
  if (missingRows > 0)
    reasons.push(tp(isInvoice ? 'rowsWithoutInvoice' : 'rowsWithoutFile', missingRows))
  if (failedFiles > 0) reasons.push(t('filesFailed', { count: failedFiles }))

  return t('partialDownload', {
    downloaded: downloadedFiles,
    expected: expectedFiles,
    reasons: reasons.join(', '),
  })
}

/**
 * A part is taken verbatim — a caller passing a *filename* strips the extension itself, because
 * doing it here would eat the tail of an investment name like „Dom ul. Polna 3".
 */
export function buildArchiveName(parts: string[], date: string, prefix: string): string {
  const safeParts = parts.map(sanitizeForFilename).filter(Boolean)
  return [prefix, ...safeParts, date].join('-') + '.zip'
}
