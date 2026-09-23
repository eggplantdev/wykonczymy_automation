import { pluralize } from '@/lib/utils/polish-plural'
import { splitExtension } from '@/lib/utils/append-short-id'
import type { ArchiveCopyT, PreviewFileT } from '@/types/media'

/**
 * The widest row shape the zip loop needs — satisfied by both `TransferRowT` and
 * `MaterialTransactionRowT`. `description` is nullable because the materiały rows allow it; it only
 * ever feeds the generated filename, so an empty one degrades to a date-only name.
 */
export type ArchiveRowT = {
  date: string
  description: string | null
  invoices: PreviewFileT[]
}

export type ArchiveFileT = {
  url: string
  // Already deduped against every other file in the archive.
  name: string
}

/**
 * Rows → the flat file list the archive actually fetches. Flattening up front is what keeps the
 * batch size bounding concurrent *fetches*: six rows of three pages each would otherwise fire
 * eighteen requests at once. Names dedupe across the whole list, so a three-page row lands as
 * `date_Opis.jpg`, `…_1.jpg`, `…_2.jpg`.
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

/** Suffixes `_1`, `_2`, … before the extension until the name is free, then reserves it. */
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

// Rows and files are counted separately because one row yields several pages — conflating them
// lets the tally print „Pobrano 9 z 5".
type ArchiveTallyT = {
  rows: number
  // Of those, the ones carrying at least one page.
  rowsWithFile: number
  expectedFiles: number
  downloadedFiles: number
}

/**
 * The closing toast. A bare success count reads as a complete set, so a partial result has to say
 * which of the two shortfalls it hit: rows that never had a file attached, and pages that failed
 * to fetch. Pure, so the wording is testable without a browser.
 */
export function buildArchiveMessage(
  { rows, rowsWithFile, expectedFiles, downloadedFiles }: ArchiveTallyT,
  copy: ArchiveCopyT,
): string {
  if (rowsWithFile === 0) return copy.empty
  if (downloadedFiles === 0) return copy.failed

  const missingRows = rows - rowsWithFile
  const failedFiles = expectedFiles - downloadedFiles
  if (missingRows === 0 && failedFiles === 0) {
    return `Pobrano ${downloadedFiles} ${pluralize(downloadedFiles, copy.noun)}`
  }

  const reasons: string[] = []
  if (missingRows > 0)
    reasons.push(`${missingRows} ${pluralizeRow(missingRows)} ${copy.rowWithoutFile}`)
  if (failedFiles > 0) reasons.push(`${failedFiles} nie do pobrania`)

  return `Pobrano ${downloadedFiles} z ${expectedFiles} — ${reasons.join(', ')}`
}

/**
 * `<prefix>-<part>-<part>-<date>.zip`. Parts are caller-supplied context (investment name, dataset
 * label) and go through `sanitizeForFilename` because an investment name may carry `/` or `:`. No
 * parts yields the bare `<prefix>-<date>.zip` the transfers export has always produced. A part is
 * taken verbatim — a caller passing a *filename* strips the extension itself, because doing it here
 * would eat the tail of an investment name like „Dom ul. Polna 3".
 */
export function buildArchiveName(parts: string[], date: string, prefix: string): string {
  const safeParts = parts.map(sanitizeForFilename).filter(Boolean)
  return [prefix, ...safeParts, date].join('-') + '.zip'
}

// „pozycja" = a row of the list, as distinct from the pages it carries.
function pluralizeRow(count: number): string {
  return pluralize(count, ['pozycja', 'pozycje', 'pozycji'])
}
