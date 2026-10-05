import { generateObject } from 'ai'
import { openrouter, timeoutSignal } from './openrouter-client'
import {
  receiptExtractionSchema,
  UNREADABLE_RECEIPT,
  type ReceiptExtractionT,
} from './receipt-extraction-schema'
import { receiptPdfPlugins } from './receipt-pdf-plugins'
import { logError } from '@/lib/utils/log-error'

// Server-only through `./openrouter-client`: never pull it into the Payload CLI graph.

// Reads Polish receipts (images) AND PDFs natively — the latter matters because our real
// invoices are Stimulsoft/Quartz PDFs with no text layer, which the free pdf-text parser
// can't read; a PDF-native model handles them without the paid mistral-ocr engine. Isolated
// to one constant so swapping cost/quality is a one-line change. On-trial cheaper tier.
export const RECEIPT_MODEL = 'google/gemini-3.1-flash-lite'

// Known-good fallback: extractReceipt retries once with this when the (cheaper, on-trial)
// primary throws, so a wrong/unavailable RECEIPT_MODEL id degrades to slower-but-working
// instead of failing every scan. Confirmed reads the Stimulsoft/Quartz PDFs + images.
export const FALLBACK_MODEL = 'google/gemini-2.5-flash'

// Per-attempt ceiling on the vision call. Without it a hung upstream request never settles, so
// the batch fill's Promise.all wedges and isFilling never clears (spinner stuck forever). On
// timeout the attempt aborts and throws, so the row degrades into failedIndices like any other
// failure.
export const RECEIPT_TIMEOUT_MS = 30_000

// Each extra page is more bytes to upload and more document for the model to read, so a longer
// document needs a budget that grows with it — a fixed 30 s would fail a long invoice for the wrong
// reason. A timeout still fails the whole row, which is correct: half a document yields a wrong total.
export const RECEIPT_TIMEOUT_PER_PAGE_MS = 15_000

// The product deliberately puts no cap on how many pages an invoice HAS; this caps how many go into
// one scan, and exists purely so the budget above stays inside the function's wall-clock limit:
// (30s + 15s × 7) × 2 attempts = 270s, under the 300s ceiling the route declares. Without it a
// caller could hand over 200 files and the platform would kill the invocation mid-flight, which
// reaches the user as an unparseable HTML 504 instead of the per-row failure path.
export const MAX_RECEIPT_PAGES = 8

export type ReceiptPageT = { bytes: Uint8Array; mediaType: string; filename: string }

// Send the image BYTES, not a URL: media.url can be relative (local Payload route) or a
// private/non-passthrough blob URL the provider can't fetch — the AI SDK then mis-encodes
// the URL string as base64 and OpenAI rejects it (invalid_base64 / invalid_image_format).
// Bytes work everywhere. Caller resolves + fetches the bytes (it has the request origin).
//
// `pages` are the pages of ONE document, in reading order — one model call sees all of them, so a
// total printed on the last page is found just as well as one on the first.
export async function extractReceipt(
  pages: ReceiptPageT[],
  otherCategoryNames: string[],
): Promise<ReceiptExtractionT> {
  if (pages.length === 0) throw new Error('Brak pliku do odczytania')
  const otherCategoryList = otherCategoryNames.length > 0 ? otherCategoryNames.join('\n') : '(none)'

  const promptText = [
    'Read this receipt or invoice (the document is in Polish) and fill in the fields.',
    'The document may span several files below, in page order — read them as ONE document and',
    'report each total once for the whole of it, wherever on the pages it is printed.',
    'If the image is not a legible receipt or invoice (blank, noise, a photo of',
    `something else), set description to exactly "${UNREADABLE_RECEIPT}", amount and`,
    'netAmount to null, and the other text fields to "" — do NOT guess or echo these',
    'instructions.',
    '- description: the seller/vendor name, a space, then the document date as',
    '  DD.MM.YYYY (e.g. "Castorama 05.03.2026"). Normalize the vendor to a clean',
    '  canonical name: Title Case, drop legal suffixes (SP. Z O.O., S.A., etc.). If',
    '  the date is unreadable, give the vendor name alone; if the vendor is',
    `  unreadable, return "${UNREADABLE_RECEIPT}".`,
    '- amount: the gross total (total due) as a number; null if unreadable.',
    '- netAmount: the net total EXACTLY AS PRINTED on the document — a "wartość netto"',
    '  or "netto razem" total, or the netto column of the VAT summary table. Return null',
    '  if the document prints no net total. NEVER calculate it: do not subtract VAT from',
    '  the gross total and do not derive it from a VAT rate such as "w tym VAT 23%". A',
    '  null here is correct and expected on a simple receipt (paragon).',
    '- invoiceNote: the receipt/invoice number on its OWN line, then each purchased',
    '  line item (product/service name) on its OWN line below it — separate every',
    '  line with a newline ("\\n"), e.g. "FV 123/2026\\nCement 25kg\\nGrunt 5l".',
    '  Include whichever part is legible; "" if neither is.',
    '- otherCategoryName: pick EXACTLY one of the categories below, copied',
    '  verbatim, or "" if none fit. Do not invent a new value.',
    '',
    'Available categories (for otherCategoryName):',
    otherCategoryList,
  ].join('\n')

  async function callModel(model: string): Promise<ReceiptExtractionT> {
    const result = await generateObject({
      // The file-parser plugin routes PDFs to the `native` engine (the model reads PDFs
      // natively); images carry no plugin. Without an explicit engine OpenRouter would default
      // PDFs to the paid mistral-ocr — see receipt-pdf-plugins.ts.
      model: openrouter(model, {
        plugins: receiptPdfPlugins(pages.map((page) => page.mediaType)),
      }),
      abortSignal: timeoutSignal(
        RECEIPT_TIMEOUT_MS + RECEIPT_TIMEOUT_PER_PAGE_MS * (pages.length - 1),
        'receipt extraction',
      ),
      schema: receiptExtractionSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            // `filename` is REQUIRED for PDFs: OpenRouter routes the file by its extension, and
            // the provider sends filename:"" when it's absent — the PDF then reaches the model
            // unrouted and comes back unreadable.
            ...pages.map(({ bytes, mediaType, filename }) => ({
              type: 'file' as const,
              data: bytes,
              mediaType,
              filename,
            })),
          ],
        },
      ],
    })
    return result.object
  }

  try {
    let object: ReceiptExtractionT
    try {
      object = await callModel(RECEIPT_MODEL)
    } catch (primaryError) {
      // TODO(EX-449) SENTRY-REQUIRED: the primary (on-trial) model failed — retry once with the
      // known-good FALLBACK_MODEL so a bad/unavailable primary id doesn't kill every scan. Log
      // the primary failure since a silent fallback hides that the trial tier is broken.
      logError(`[receipt] primary model ${RECEIPT_MODEL} failed — falling back`, primaryError)
      object = await callModel(FALLBACK_MODEL)
    }

    // TODO(EX-449) SENTRY-REQUIRED: an unreadable result is a silent AI failure — generateObject
    // succeeded, so nothing throws and the user just sees the sentinel in the Opis. It must be
    // captured as a Sentry error once Sentry is wired (mediaType included so PDF-specific
    // parse failures are separable from genuinely illegible images).
    if (object.description === UNREADABLE_RECEIPT) {
      const mediaTypes = pages.map((page) => page.mediaType).join(',')
      const bytes = pages.reduce((total, page) => total + page.bytes.byteLength, 0)
      logError(
        `[receipt] unreadable extraction (pages=${pages.length}, mediaTypes=${mediaTypes}, filename=${pages[0].filename}, bytes=${bytes})`,
      )
    }

    return object
  } catch (error) {
    // TODO(EX-449) SENTRY-REQUIRED: receipt extraction failures must be captured once Sentry is
    // wired — they are silent AI/provider errors users can't self-report.
    throw new Error(receiptErrorDetail(error))
  }
}

// TEMPORARY (TODO(EX-449)): with no Sentry yet, this flattens the provider's real failure reason
// into the toast string so it survives protectedAction (which returns only `err.message`) and
// reaches the client. Once Sentry is wired the raw fields (statusCode/responseBody/text) move into
// the capture and the toast shrinks to a clean Polish message.
function receiptErrorDetail(error: unknown): string {
  const err = error as {
    message?: string
    text?: string
    statusCode?: number
    responseBody?: string
    response?: { body?: unknown }
  }
  const providerBody = err.responseBody ?? err.response?.body
  return [
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
}
