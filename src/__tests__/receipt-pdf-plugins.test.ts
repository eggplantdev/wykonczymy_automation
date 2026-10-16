import { describe, it, expect } from 'vitest'
import { receiptPdfPlugins, RECEIPT_PDF_ENGINE } from '@/lib/ai/receipt-pdf-plugins'

describe('receiptPdfPlugins', () => {
  it('returns the native file-parser plugin for a PDF', () => {
    // needed for our
    // no-text-layer Stimulsoft/Quartz PDFs the free `pdf-text` engine returns empty for, while
    // still avoiding the paid mistral-ocr ($2/1000 pages) the OpenRouter default would pick.
    expect(receiptPdfPlugins(['application/pdf'])).toEqual([
      { id: 'file-parser', pdf: { engine: 'native' } },
    ])
    expect(RECEIPT_PDF_ENGINE).toBe('native')
  })

  it('returns undefined for image types (plain vision call, no plugin)', () => {
    expect(receiptPdfPlugins(['image/jpeg'])).toBeUndefined()
    expect(receiptPdfPlugins(['image/png'])).toBeUndefined()
    expect(receiptPdfPlugins(['image/heic', 'image/png'])).toBeUndefined()
  })

  // The plugin is declared per CALL, not per part, so a multi-page invoice mixing a photo and a
  // PDF page still needs it on — otherwise the PDF page reaches the model unparsed.
  it('turns the plugin on when a single page among images is a PDF', () => {
    expect(receiptPdfPlugins(['image/png', 'application/pdf'])).toEqual([
      { id: 'file-parser', pdf: { engine: 'native' } },
    ])
  })
})
