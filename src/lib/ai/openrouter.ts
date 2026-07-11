import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { serverEnv } from '@/lib/env/server'
import { receiptExtractionSchema, type ReceiptExtractionT } from './receipt-extraction-schema'

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

// Blob URLs are public, so the model fetches the image itself — no server-side byte fetch.
export async function extractReceipt(
  imageUrl: string,
  mediaType: string,
  expenseCategoryNames: string[],
): Promise<ReceiptExtractionT> {
  const categoryList = expenseCategoryNames.length > 0 ? expenseCategoryNames.join('\n') : '(brak)'

  const { object } = await generateObject({
    model: openrouter(RECEIPT_MODEL),
    schema: receiptExtractionSchema,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Odczytaj ten paragon lub fakturę (język polski) i wypełnij pola:',
              '- description: krótki opis zakupu (sprzedawca lub główna pozycja).',
              '- amount: kwota brutto (razem do zapłaty) jako liczba; null jeśli nieczytelna.',
              '- invoiceNote: numer paragonu/faktury lub inna istotna notatka; "" jeśli brak.',
              '- expenseCategoryName: wybierz DOKŁADNIE jedną z poniższych kategorii, przepisaną',
              '  wiernie, albo "" jeśli żadna nie pasuje. Nie wymyślaj nowej kategorii.',
              '',
              'Dostępne kategorie:',
              categoryList,
            ].join('\n'),
          },
          { type: 'file', data: imageUrl, mediaType },
        ],
      },
    ],
  })

  return object
}
