import { extractReceipt, type ReceiptPageT } from '@/lib/ai/openrouter'
import { UNREADABLE_RECEIPT, type ReceiptExtractionT } from '@/lib/ai/receipt-extraction-schema'
import { buildReceiptFileName } from '@/lib/utils/receipt-filename'

// `filename` is the Opis-based name the client applies to the file before its submit-time upload
// (undefined when the receipt was unreadable). A scan persists NOTHING — the file is uploaded
// once, at submit — so this rename lands there, never as a mid-scan storage write.
export type ReceiptFillResultT = ReceiptExtractionT & { filename?: string }

/**
 * Read one invoice — which may span several pages, in order — and shape the model's answer for the
 * form. Takes the picked Files and hands the model their bytes; no media record is created (that
 * would orphan the moment the user removes the row or abandons the form).
 */
export async function scanReceipt(
  files: File[],
  otherCategoryNames: string[],
): Promise<ReceiptFillResultT> {
  const pages: ReceiptPageT[] = await Promise.all(
    files.map(async (file) => ({
      bytes: new Uint8Array(await file.arrayBuffer()),
      mediaType: file.type,
      // The file-parser plugin routes PDFs by extension, so the filename must carry one. Fall
      // back to a synthetic name derived from the mime subtype when the File has none.
      filename: file.name || `receipt.${file.type.split('/')[1] ?? 'pdf'}`,
    })),
  )
  return scanReceiptPages(pages, otherCategoryNames)
}

/** The read itself, for a caller that already holds the bytes — the server read of a worker's draft. */
export async function scanReceiptPages(
  pages: ReceiptPageT[],
  otherCategoryNames: string[],
): Promise<ReceiptFillResultT> {
  const data = await extractReceipt(pages, otherCategoryNames)

  // Derive the Opis-based name for the client to apply before upload; skip on the unreadable
  // sentinel or an empty Opis so the original filename is kept. Page 1 supplies the extension —
  // the client suffixes the remaining pages off this base.
  const filename =
    data.description && data.description !== UNREADABLE_RECEIPT
      ? buildReceiptFileName(data.description, pages[0].filename)
      : undefined

  // Drop a netto the form would reject anyway, so the user gets a blank field instead of a red
  // error on a number they never typed. Mirrors getNetAmountError's range rule by hand — that
  // helper is transfer-type-aware and the scan has no type. Equality survives (VAT-exempt
  // invoices print it), as does a netto with no brutto to compare against.
  const netAmount =
    data.netAmount !== null &&
    (data.netAmount <= 0 || (data.amount !== null && data.netAmount > data.amount))
      ? null
      : data.netAmount

  return { ...data, netAmount, filename }
}
