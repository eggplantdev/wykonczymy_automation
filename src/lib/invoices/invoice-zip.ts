import { pluralize } from '@/lib/utils/polish-plural'
import { splitExtension } from '@/lib/utils/append-short-id'
import type { InvoiceFileT } from '@/types/transfers'

/**
 * The widest row shape the zip loop needs — satisfied by both `TransferRowT` and
 * `MaterialTransactionRowT`. `description` is nullable because the materiały rows allow it; it only
 * ever feeds the generated filename, so an empty one degrades to a date-only name.
 */
export type InvoiceZipRowT = {
  date: string
  description: string | null
  invoices: InvoiceFileT[]
}

export type InvoiceZipFileT = {
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
export function flattenInvoiceRows(rows: InvoiceZipRowT[]): InvoiceZipFileT[] {
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
export type InvoiceZipTallyT = {
  // Rows the user asked for — the whole visible set, invoice or not.
  rows: number
  // Of those, the ones carrying at least one page.
  rowsWithInvoice: number
  // Pages the archive set out to fetch.
  expectedFiles: number
  // Pages whose blob actually made it into the archive.
  downloadedFiles: number
}

/**
 * The closing toast. A bare success count reads as a complete set, so a partial result has to say
 * which of the two shortfalls it hit: rows that never had an invoice attached, and pages that failed
 * to fetch. Pure, so the wording is testable without a browser.
 */
export function buildInvoiceZipMessage({
  rows,
  rowsWithInvoice,
  expectedFiles,
  downloadedFiles,
}: InvoiceZipTallyT): string {
  if (rowsWithInvoice === 0) return 'Brak faktur do pobrania'
  if (downloadedFiles === 0) return 'Nie udało się pobrać żadnej faktury'

  const missingRows = rows - rowsWithInvoice
  const failedFiles = expectedFiles - downloadedFiles
  if (missingRows === 0 && failedFiles === 0) {
    return `Pobrano ${downloadedFiles} ${pluralizeInvoice(downloadedFiles)}`
  }

  const reasons: string[] = []
  if (missingRows > 0) reasons.push(`${missingRows} ${pluralizeRow(missingRows)} bez faktury`)
  if (failedFiles > 0) reasons.push(`${failedFiles} nie do pobrania`)

  return `Pobrano ${downloadedFiles} z ${expectedFiles} — ${reasons.join(', ')}`
}

/**
 * `faktury-<part>-<part>-<date>.zip`. Parts are caller-supplied context (investment name, dataset
 * label) and go through `sanitizeForFilename` because an investment name may carry `/` or `:`. No
 * parts yields the generic `faktury-<date>.zip` the transfers export has always produced. A part is
 * taken verbatim — a caller passing a *filename* strips the extension itself, because doing it here
 * would eat the tail of an investment name like „Dom ul. Polna 3".
 */
// `prefix` is what the archive calls itself — the preview dialog also serves non-invoice files,
// and a zip of site photos named „faktury-…" is a wrong answer to „what did I just download".
export function buildInvoiceArchiveName(parts: string[], date: string, prefix = 'faktury'): string {
  const safeParts = parts.map(sanitizeForFilename).filter(Boolean)
  return [prefix, ...safeParts, date].join('-') + '.zip'
}

// Singular is accusative here — the noun only ever appears as the object of „Pobrano".
export function pluralizeInvoice(count: number): string {
  return pluralize(count, ['fakturę', 'faktury', 'faktur'])
}

// „pozycja" = a row of the list, as distinct from the pages it carries.
function pluralizeRow(count: number): string {
  return pluralize(count, ['pozycja', 'pozycje', 'pozycji'])
}
