'use server'

import { headers } from 'next/headers'
import type { ActionResultT } from '@/types/action'
import { protectedAction } from './run-action'
import { extractReceipt } from '@/lib/ai/openrouter'
import { UNREADABLE_RECEIPT, type ReceiptExtractionT } from '@/lib/ai/receipt-extraction-schema'
import { buildReceiptFileName } from '@/lib/utils/receipt-filename'

type ExtractReceiptInputT = {
  mediaId: number
  expenseCategoryNames: string[]
  otherCategoryNames: string[]
}

// `filename` is the media's new stored name after the Opis-based rename (undefined if the
// rename was skipped or failed), so the client can mirror it on the FV label.
export type ReceiptFillResultT = ReceiptExtractionT & { filename?: string }

// Resolve an already-uploaded media doc, fetch its bytes, run vision extraction, then rename
// the stored file to match the extracted Opis so the receipt is identifiable in storage.
// Takes a mediaId (never a File) — the repo uploads via the /api/upload-file route, so Files
// never travel through a server action.
export async function extractReceiptAction(
  input: ExtractReceiptInputT,
): Promise<ActionResultT<ReceiptFillResultT>> {
  return protectedAction('extractReceiptAction', async ({ payload }) => {
    const media = await payload.findByID({ collection: 'media', id: input.mediaId, depth: 0 })
    const url = media?.url
    const mimeType = media?.mimeType
    const currentName = media?.filename
    if (!url || !mimeType) return { success: false, error: 'Nie znaleziono pliku' }

    // media.url is relative on the local Payload route and absolute on blob storage.
    // Absolutize against the request origin so the fetch works in both, then hand the
    // model bytes — a URL the provider can't reach gets mis-encoded as base64. PDFs ride the
    // same path; OpenRouter's file-parser plugin (see extractReceipt) parses them server-side.
    const requestHeaders = await headers()
    const host = requestHeaders.get('host')
    const proto = requestHeaders.get('x-forwarded-proto') ?? 'http'
    const absoluteUrl = host ? new URL(url, `${proto}://${host}`).toString() : url

    const response = await fetch(absoluteUrl)
    if (!response.ok)
      return { success: false, error: `Nie udało się pobrać pliku (HTTP ${response.status})` }
    const imageBytes = new Uint8Array(await response.arrayBuffer())

    const data = await extractReceipt(
      imageBytes,
      mimeType,
      input.expenseCategoryNames,
      input.otherCategoryNames,
    )

    // Rename the stored file to the extracted Opis (re-supply the bytes so the storage adapter
    // moves the blob and drops the old one; a filename-only update would strand it). Skip when
    // the Opis is empty or the unreadable sentinel — keep the original upload name.
    let filename: string | undefined
    if (data.description && data.description !== UNREADABLE_RECEIPT) {
      try {
        const newName = buildReceiptFileName(data.description, currentName ?? url)
        await payload.update({
          collection: 'media',
          id: input.mediaId,
          data: { filename: newName },
          file: {
            data: Buffer.from(imageBytes),
            mimetype: mimeType,
            name: newName,
            size: imageBytes.byteLength,
          },
          // MANAGER can run the fill but the collection's `update` is admin/owner-only — bypass
          // it here so the rename (an internal side effect of a flow they're authorized for)
          // still lands, without opening media editing in the admin panel to managers.
          overrideAccess: true,
        })
        filename = newName
      } catch (renameError) {
        // SENTRY-REQUIRED (EX-449): a rename failure must not fail extraction — the Opis/amount
        // are the valuable output, a stale filename is cosmetic. Log and keep the original name.
        console.error('[receipt] media rename failed', renameError)
      }
    }

    return { success: true, data: { ...data, filename } }
  })
}
