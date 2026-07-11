import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { serverEnv } from '@/lib/env/server'
import { receiptExtractionSchema, type ReceiptExtractionT } from './receipt-extraction-schema'
import { receiptPdfPlugins } from './receipt-pdf-plugins'

// Importing `serverEnv` (which is `import 'server-only'`) makes this module server-only too:
// never pull it into the Payload CLI graph (payload.config.ts / collections), or
// `payload generate:types` throws.

// Cheapest vision model that reads Polish receipts acceptably. Isolated to one constant so
// tuning cost/latency is a one-line swap once the DB-fixtures eval calibrates accuracy.
export const RECEIPT_MODEL = 'openai/gpt-4o-mini'

const openrouter = createOpenRouter({
  apiKey: serverEnv.OPENROUTER_API_KEY,
  // Attribution headers OpenRouter surfaces on its dashboard; omitted when unset.
  headers: {
    ...(serverEnv.OPENROUTER_HTTP_REFERER
      ? { 'HTTP-Referer': serverEnv.OPENROUTER_HTTP_REFERER }
      : {}),
    ...(serverEnv.OPENROUTER_APP_NAME ? { 'X-Title': serverEnv.OPENROUTER_APP_NAME } : {}),
  },
})

// Send the image BYTES, not a URL: media.url can be relative (local Payload route) or a
// private/non-passthrough blob URL the provider can't fetch — the AI SDK then mis-encodes
// the URL string as base64 and OpenAI rejects it (invalid_base64 / invalid_image_format).
// Bytes work everywhere. Caller resolves + fetches the bytes (it has the request origin).
export async function extractReceipt(
  imageBytes: Uint8Array,
  mediaType: string,
  expenseCategoryNames: string[],
): Promise<ReceiptExtractionT> {
  const categoryList = expenseCategoryNames.length > 0 ? expenseCategoryNames.join('\n') : '(none)'

  const promptText = [
    'Read this receipt or invoice (the document is in Polish) and fill in the fields:',
    '- description: a short description of the purchase (vendor or main item).',
    '- amount: the gross total (total due) as a number; null if unreadable.',
    '- invoiceNote: the receipt/invoice number or another relevant note; "" if none.',
    '- expenseCategoryName: pick EXACTLY one of the categories below, copied',
    '  verbatim, or "" if none fit. Do not invent a new category.',
    '',
    'Available categories:',
    categoryList,
  ].join('\n')

  try {
    const result = await generateObject({
      // PDFs need the file-parser plugin (pdf-text) to be parsed server-side; images get none.
      model: openrouter(RECEIPT_MODEL, { plugins: receiptPdfPlugins(mediaType) }),
      schema: receiptExtractionSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'file', data: imageBytes, mediaType },
          ],
        },
      ],
    })

    return result.object
  } catch (error) {
    // SENTRY-REQUIRED (EX-449): receipt extraction failures must be captured once Sentry is
    // wired — they are silent AI/provider errors users can't self-report.
    const err = error as {
      name?: string
      message?: string
      text?: string
      statusCode?: number
      responseBody?: string
      finishReason?: string
      usage?: unknown
      cause?: unknown
      response?: { body?: unknown }
    }
    // Re-throw with the provider's actual reason folded into the message so it survives
    // protectedAction (which returns only `err.message`) and reaches the client toast.
    const providerBody = err.responseBody ?? err.response?.body
    const detail = [
      err.message ?? 'Błąd odczytu paragonu',
      err.statusCode ? `HTTP ${err.statusCode}` : undefined,
      providerBody
        ? typeof providerBody === 'string'
          ? providerBody
          : JSON.stringify(providerBody)
        : undefined,
      err.text ? `model: ${err.text}` : undefined,
    ]
      .filter(Boolean)
      .join(' · ')
    throw new Error(detail)
  }
}
