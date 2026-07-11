// Free OpenRouter file-parser engine for text-layer PDFs (digital invoices). Isolated to one
// constant so it can never silently drift to the paid mistral-ocr fallback ($2/1000 pages).
export const RECEIPT_PDF_ENGINE = 'pdf-text'

type FileParserPluginT = { id: 'file-parser'; pdf: { engine: string } }

// A vision model can't read PDF bytes directly, so PDFs need OpenRouter's file-parser plugin to
// extract text server-side; image receipts are sent as-is with no plugin.
export function receiptPdfPlugins(mediaType: string): FileParserPluginT[] | undefined {
  if (mediaType === 'application/pdf')
    return [{ id: 'file-parser', pdf: { engine: RECEIPT_PDF_ENGINE } }]
  return undefined
}
