// 'native' hands the PDF to the model's own multimodal handling (RECEIPT_MODEL is PDF-native)
// instead of extracting text server-side — needed because our invoices are Stimulsoft/Quartz
// PDFs with no text layer, which the free 'pdf-text' engine returns empty for. Still avoids the
// paid 'mistral-ocr' engine ($2/1000 pages); flip back to 'pdf-text' only with a non-PDF model.
export const RECEIPT_PDF_ENGINE = 'native'

type FileParserPluginT = { id: 'file-parser'; pdf: { engine: string } }

// A vision model can't read PDF bytes directly, so PDFs need OpenRouter's file-parser plugin to
// extract text server-side; image receipts are sent as-is with no plugin.
export function receiptPdfPlugins(mediaType: string): FileParserPluginT[] | undefined {
  if (mediaType === 'application/pdf')
    return [{ id: 'file-parser', pdf: { engine: RECEIPT_PDF_ENGINE } }]
  return undefined
}
