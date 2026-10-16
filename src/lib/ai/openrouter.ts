import { generateObject } from 'ai'
import type { z } from 'zod'
import { sanitizeReceiptExtraction } from './extract-receipt-sanitize'
import { openrouter, timeoutSignal, withModelFallback } from './openrouter-client'
import { providerErrorDetail } from './provider-error-detail'
import {
  receiptExtractionSchema,
  receiptListExtractionSchema,
  UNREADABLE_RECEIPT,
  type ReceiptExtractionT,
} from './receipt-extraction-schema'
import { receiptPdfPlugins } from './receipt-pdf-plugins'
import { logError } from '@/lib/utils/log-error'

export const RECEIPT_MODEL = 'google/gemini-3.1-flash-lite'

// Without it a hung upstream request never settles, so the batch fill's Promise.all wedges and isFilling never clears (spinner stuck forever).
export const RECEIPT_TIMEOUT_MS = 30_000

export const RECEIPT_TIMEOUT_PER_PAGE_MS = 15_000

export type ReceiptPageT = { bytes: Uint8Array; mediaType: string; filename: string }

const FIELD_RULES = [
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
  '- documentNumber: the receipt/invoice number alone — the same value as the first',
  '  line of invoiceNote (on a paragon: the "nr wydr." value); "" if unreadable.',
  '- sellerNip: the NIP of the SELLER (the shop or company that issued the document),',
  '  digits only. An invoice also prints the BUYER\'s NIP ("Nabywca") — NEVER return',
  '  that one. Copy it ONLY when it is printed on THIS document; "" if it is not printed',
  '  (a parking ticket prints none) or not legible. NEVER fill it in from what you know',
  '  about the seller.',
  '- documentDate: the document date printed on it as YYYY-MM-DD (the same date as in',
  '  description); "" if unreadable.',
  '- otherCategoryName: pick EXACTLY one of the categories below, copied',
  '  verbatim, or "" if none fit. Do not invent a new value.',
]

const categoryRules = (otherCategoryNames: string[]) => [
  '',
  'Available categories (for otherCategoryName):',
  otherCategoryNames.length > 0 ? otherCategoryNames.join('\n') : '(none)',
]

// Send the image BYTES, not a URL: media.url can be relative (local Payload route) or a
// private/non-passthrough blob URL the provider can't fetch — the AI SDK then mis-encodes
// the URL string as base64 and OpenAI rejects it (invalid_base64 / invalid_image_format).
async function readWithModel<SchemaT extends z.ZodType>(
  pages: ReceiptPageT[],
  schema: SchemaT,
  promptText: string,
): Promise<z.infer<SchemaT>> {
  if (pages.length === 0) throw new Error('Brak pliku do odczytania')

  async function callModel(model: string) {
    const result = await generateObject({
      model: openrouter(model, {
        plugins: receiptPdfPlugins(pages.map((page) => page.mediaType)),
      }),
      abortSignal: timeoutSignal(
        RECEIPT_TIMEOUT_MS + RECEIPT_TIMEOUT_PER_PAGE_MS * (pages.length - 1),
        'receipt extraction',
      ),
      schema,
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
    return result.object as z.infer<SchemaT>
  }

  try {
    return await withModelFallback('receipt', RECEIPT_MODEL, callModel)
  } catch (error) {
    // TODO(EX-958) SENTRY-REQUIRED: receipt extraction failures must be captured once Sentry is
    // wired — they are silent AI/provider errors users can't self-report.
    throw new Error(providerErrorDetail(error, 'Błąd odczytu paragonu'))
  }
}

// TODO(EX-958) SENTRY-REQUIRED: an unreadable result is a silent AI failure — generateObject
// succeeded, so nothing throws.
function logUnreadable(pages: ReceiptPageT[]) {
  const mediaTypes = pages.map((page) => page.mediaType).join(',')
  const bytes = pages.reduce((total, page) => total + page.bytes.byteLength, 0)
  logError(
    `[receipt] unreadable extraction (pages=${pages.length}, mediaTypes=${mediaTypes}, filename=${pages[0].filename}, bytes=${bytes})`,
  )
}

export async function extractReceipt(
  pages: ReceiptPageT[],
  otherCategoryNames: string[],
): Promise<ReceiptExtractionT> {
  const promptText = [
    'Read this receipt or invoice (the document is in Polish) and fill in the fields.',
    'The document may span several files below, in page order — read them as ONE document and',
    'report each total once for the whole of it, wherever on the pages it is printed.',
    'If the image is not a legible receipt or invoice (blank, noise, a photo of',
    `something else), set description to exactly "${UNREADABLE_RECEIPT}", amount and`,
    'netAmount to null, and the other text fields to "" — do NOT guess or echo these',
    'instructions.',
    ...FIELD_RULES,
    ...categoryRules(otherCategoryNames),
  ].join('\n')

  const object = await readWithModel(pages, receiptExtractionSchema, promptText)
  if (object.description === UNREADABLE_RECEIPT) logUnreadable(pages)
  return sanitizeReceiptExtraction(object)
}

export async function extractReceipts(
  pages: ReceiptPageT[],
  otherCategoryNames: string[],
): Promise<ReceiptExtractionT[]> {
  const promptText = [
    'The image below may show ONE OR SEVERAL separate receipts or invoices (the documents are in',
    'Polish) — e.g. several paragony laid side by side or overlapping in one photo. Find EVERY',
    'separate document and return one entry per document in `receipts`. Two documents are separate',
    'when they have their own total (SUMA PLN / Do zapłaty) and their own receipt number. NEVER add',
    'the totals of separate documents together. Before answering, go over the WHOLE photo — every',
    'corner and edge, including documents shot at an angle, smaller or from another shop — and',
    'count the documents; a legible one you leave out is as wrong as a total you invent.',
    'Parking tickets (bilet parkingowy / bilet kontrolny) are documents too. A card-terminal slip',
    '(SPRZEDAŻ, TRANSAKCJA ZAAKCEPTOWANA, PIN, KARTA) is NOT a document: it only confirms paying for',
    'another one, so never return it as its own entry. Skip a document whose total is covered by',
    'another document or not legible. Return an empty list if no legible receipt or invoice is',
    'shown — do NOT guess or echo these instructions.',
    'For each entry:',
    ...FIELD_RULES,
    ...categoryRules(otherCategoryNames),
  ].join('\n')

  const { receipts } = await readWithModel(pages, receiptListExtractionSchema, promptText)
  if (
    receipts.length === 0 ||
    receipts.some((receipt) => receipt.description === UNREADABLE_RECEIPT)
  ) {
    logUnreadable(pages)
  }
  return receipts.map(sanitizeReceiptExtraction)
}
