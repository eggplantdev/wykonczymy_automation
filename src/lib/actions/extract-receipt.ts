'use server'

import type { ActionResultT } from '@/types/action'
import { protectedAction } from './run-action'
import { extractReceipt } from '@/lib/ai/openrouter'
import type { ReceiptExtractionT } from '@/lib/ai/receipt-extraction-schema'

type ExtractReceiptInputT = {
  mediaId: number
  expenseCategoryNames: string[]
}

// Pure read: resolve an already-uploaded media doc to its blob URL, then run vision
// extraction. Takes a mediaId (never a File) — the repo uploads via the /api/upload-file
// route, so Files never travel through a server action. No mutation, no cache revalidation.
export async function extractReceiptAction(
  input: ExtractReceiptInputT,
): Promise<ActionResultT<ReceiptExtractionT>> {
  return protectedAction('extractReceiptAction', async ({ payload }) => {
    const media = await payload.findByID({ collection: 'media', id: input.mediaId, depth: 0 })
    const url = media?.url
    const mimeType = media?.mimeType
    if (!url || !mimeType) return { success: false, error: 'Nie znaleziono pliku' }
    if (!mimeType.startsWith('image/'))
      return { success: false, error: 'Nie można odczytać pliku PDF' }

    const data = await extractReceipt(url, mimeType, input.expenseCategoryNames)
    return { success: true, data }
  })
}
