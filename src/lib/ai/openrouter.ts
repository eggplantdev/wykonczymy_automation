import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { serverEnv } from '@/lib/env/server'
import {
  receiptExtractionSchema,
  UNREADABLE_RECEIPT,
  type ReceiptExtractionT,
} from './receipt-extraction-schema'
import { receiptPdfPlugins } from './receipt-pdf-plugins'

// Importing `serverEnv` (which is `import 'server-only'`) makes this module server-only too:
// never pull it into the Payload CLI graph (payload.config.ts / collections), or
// `payload generate:types` throws.

// Reads Polish receipts (images) AND PDFs natively — the latter matters because our real
// invoices are Stimulsoft/Quartz PDFs with no text layer, which the free pdf-text parser
// can't read; a PDF-native model handles them without the paid mistral-ocr engine. Isolated
// to one constant so swapping cost/quality (e.g. back to openai/gpt-4o-mini for images-only)
// is a one-line change.
// google/gemini-2.5-flash — confirmed working (reads the Stimulsoft/Quartz PDFs + images);
// keep as the known-good fallback while trialing the cheaper 3.1-flash-lite tier below.
// export const RECEIPT_MODEL = 'google/gemini-2.5-flash'
export const RECEIPT_MODEL = 'google/gemini-3.1-flash-lite'

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
  filename: string,
  expenseCategoryNames: string[],
  otherCategoryNames: string[],
): Promise<ReceiptExtractionT> {
  const categoryList = expenseCategoryNames.length > 0 ? expenseCategoryNames.join('\n') : '(none)'
  const otherCategoryList = otherCategoryNames.length > 0 ? otherCategoryNames.join('\n') : '(none)'

  const promptText = [
    'Read this receipt or invoice (the document is in Polish) and fill in the fields.',
    'If the image is not a legible receipt or invoice (blank, noise, a photo of',
    `something else), set description to exactly "${UNREADABLE_RECEIPT}", amount to`,
    'null, and the other text fields to "" — do NOT guess or echo these instructions.',
    '- description: the seller/vendor name, a space, then the document date as',
    '  DD.MM.YYYY (e.g. "Castorama 05.03.2026"). Normalize the vendor to a clean',
    '  canonical name: Title Case, drop legal suffixes (SP. Z O.O., S.A., etc.). If',
    '  the date is unreadable, give the vendor name alone; if the vendor is',
    `  unreadable, return "${UNREADABLE_RECEIPT}".`,
    '- amount: the gross total (total due) as a number; null if unreadable.',
    '- invoiceNote: the receipt/invoice number on its OWN line, then each purchased',
    '  line item (product/service name) on its OWN line below it — separate every',
    '  line with a newline ("\\n"), e.g. "FV 123/2026\\nCement 25kg\\nGrunt 5l".',
    '  Include whichever part is legible; "" if neither is.',
    '- expenseCategoryName: pick EXACTLY one of the expense types below, copied',
    '  verbatim, or "" if none fit. Do not invent a new value.',
    '- otherCategoryName: pick EXACTLY one of the categories below, copied',
    '  verbatim, or "" if none fit. Do not invent a new value. This is an',
    '  independent classification from expenseCategoryName — choose each on its own.',
    '',
    'Available expense types (for expenseCategoryName):',
    categoryList,
    '',
    'Available categories (for otherCategoryName):',
    otherCategoryList,
  ].join('\n')

  try {
    const result = await generateObject({
      // The file-parser plugin routes PDFs to the `native` engine (RECEIPT_MODEL reads PDFs
      // natively); images carry no plugin. Without an explicit engine OpenRouter would default
      // PDFs to the paid mistral-ocr — see receipt-pdf-plugins.ts.
      model: openrouter(RECEIPT_MODEL, { plugins: receiptPdfPlugins(mediaType) }),
      schema: receiptExtractionSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            // `filename` is REQUIRED for PDFs: OpenRouter routes the file by its extension, and
            // the provider sends filename:"" when it's absent — the PDF then reaches the model
            // unrouted and comes back unreadable.
            { type: 'file', data: imageBytes, mediaType, filename },
          ],
        },
      ],
    })

    // SENTRY-REQUIRED (EX-449): an unreadable result is a silent AI failure — generateObject
    // succeeded, so nothing throws and the user just sees the sentinel in the Opis. It must be
    // captured as a Sentry error once Sentry is wired (mediaType included so PDF-specific
    // parse failures are separable from genuinely illegible images).
    if (result.object.description === UNREADABLE_RECEIPT) {
      console.error(
        `[receipt] unreadable extraction (mediaType=${mediaType}, filename=${filename}, bytes=${imageBytes.byteLength})`,
      )
    }

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
