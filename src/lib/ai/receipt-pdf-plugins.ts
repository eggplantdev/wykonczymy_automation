// needed because our invoices are Stimulsoft/Quartz PDFs with no text layer, which the free 'pdf-text' engine returns empty for.
export const RECEIPT_PDF_ENGINE = 'native'

type FileParserPluginT = { id: 'file-parser'; pdf: { engine: string } }

export function receiptPdfPlugins(mediaTypes: string[]): FileParserPluginT[] | undefined {
  if (mediaTypes.includes('application/pdf'))
    return [{ id: 'file-parser', pdf: { engine: RECEIPT_PDF_ENGINE } }]
  return undefined
}
