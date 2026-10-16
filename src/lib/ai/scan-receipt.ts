import { extractReceipt, extractReceipts, type ReceiptPageT } from '@/lib/ai/openrouter'
import { UNREADABLE_RECEIPT, type ReceiptExtractionT } from '@/lib/ai/receipt-extraction-schema'
import { buildReceiptFileName } from '@/lib/utils/receipt-filename'

export type ReceiptFillResultT = ReceiptExtractionT & { filename?: string }

export async function scanReceipt(
  files: File[],
  otherCategoryNames: string[],
): Promise<ReceiptFillResultT> {
  const pages: ReceiptPageT[] = await Promise.all(
    files.map(async (file) => ({
      bytes: new Uint8Array(await file.arrayBuffer()),
      mediaType: file.type,
      // The file-parser plugin routes PDFs by extension, so the filename must carry one.
      filename: file.name || `receipt.${file.type.split('/')[1] ?? 'pdf'}`,
    })),
  )
  return shapeForForm(await extractReceipt(pages, otherCategoryNames), pages)
}

export async function scanReceiptList(
  pages: ReceiptPageT[],
  otherCategoryNames: string[],
): Promise<ReceiptFillResultT[]> {
  const receipts = await extractReceipts(pages, otherCategoryNames)
  return receipts.map((data) => shapeForForm(data, pages))
}

function shapeForForm(data: ReceiptExtractionT, pages: ReceiptPageT[]): ReceiptFillResultT {
  const filename =
    data.description && data.description !== UNREADABLE_RECEIPT
      ? buildReceiptFileName(data.description, pages[0].filename)
      : undefined

  // Drop a netto the form would reject anyway, so the user gets a blank field instead of a red
  // error on a number they never typed.
  const netAmount =
    data.netAmount !== null &&
    (data.netAmount <= 0 || (data.amount !== null && data.netAmount > data.amount))
      ? null
      : data.netAmount

  return { ...data, netAmount, filename }
}
