'use server'

import type { ActionResultT } from '@/types/action'
import { protectedAction } from './run-action'
import { extractReceipt } from '@/lib/ai/openrouter'
import { UNREADABLE_RECEIPT, type ReceiptExtractionT } from '@/lib/ai/receipt-extraction-schema'
import { buildReceiptFileName } from '@/lib/utils/receipt-filename'

type ExtractReceiptInputT = {
  file: File
  otherCategoryNames: string[]
}

// `filename` is the Opis-based name the client applies to the file before its submit-time upload
// (undefined when the receipt was unreadable). A scan persists NOTHING — the file is uploaded
// once, at submit — so this rename lands there, never as a mid-scan storage write.
export type ReceiptFillResultT = ReceiptExtractionT & { filename?: string }

// Takes the picked File and hands the model its bytes — no media record is created (that would
// orphan on the server the moment the user removes the row or abandons the form). The 10mb
// serverAction body limit + client-side compression keep the File under the boundary.
export async function extractReceiptAction(
  input: ExtractReceiptInputT,
): Promise<ActionResultT<ReceiptFillResultT>> {
  return protectedAction('extractReceiptAction', async () => {
    const { file, otherCategoryNames } = input
    const mimeType = file.type
    if (!mimeType) return { success: false, error: 'Nieobsługiwany typ pliku' }

    const imageBytes = new Uint8Array(await file.arrayBuffer())
    // The file-parser plugin routes PDFs by extension, so the filename must carry one. Fall
    // back to a synthetic name derived from the mime subtype when the File has none.
    const parserFilename = file.name || `receipt.${mimeType.split('/')[1] ?? 'pdf'}`

    const data = await extractReceipt(imageBytes, mimeType, parserFilename, otherCategoryNames)

    // Derive the Opis-based name for the client to apply before upload; skip on the unreadable
    // sentinel or an empty Opis so the original filename is kept.
    const filename =
      data.description && data.description !== UNREADABLE_RECEIPT
        ? buildReceiptFileName(data.description, parserFilename)
        : undefined

    return { success: true, data: { ...data, filename } }
  })
}
