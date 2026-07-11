'use server'

import { headers } from 'next/headers'
import type { ActionResultT } from '@/types/action'
import { protectedAction } from './run-action'
import { extractReceipt } from '@/lib/ai/openrouter'
import type { ReceiptExtractionT } from '@/lib/ai/receipt-extraction-schema'

type ExtractReceiptInputT = {
  mediaId: number
  expenseCategoryNames: string[]
}

// Pure read: resolve an already-uploaded media doc, fetch its bytes, then run vision
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

    const data = await extractReceipt(imageBytes, mimeType, input.expenseCategoryNames)
    return { success: true, data }
  })
}
