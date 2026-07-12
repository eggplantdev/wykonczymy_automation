import { describe, it, expect } from 'vitest'
import { receiptPdfPlugins, RECEIPT_PDF_ENGINE } from '@/lib/ai/receipt-pdf-plugins'

describe('receiptPdfPlugins', () => {
  it('returns the native file-parser plugin for a PDF', () => {
    // Pins the engine to `native` (the PDF-native model reads the file directly) — needed for our
    // no-text-layer Stimulsoft/Quartz PDFs the free `pdf-text` engine returns empty for, while
    // still avoiding the paid mistral-ocr ($2/1000 pages) the OpenRouter default would pick.
    expect(receiptPdfPlugins('application/pdf')).toEqual([
      { id: 'file-parser', pdf: { engine: 'native' } },
    ])
    expect(RECEIPT_PDF_ENGINE).toBe('native')
  })

  it('returns undefined for image types (plain vision call, no plugin)', () => {
    expect(receiptPdfPlugins('image/jpeg')).toBeUndefined()
    expect(receiptPdfPlugins('image/png')).toBeUndefined()
    expect(receiptPdfPlugins('image/heic')).toBeUndefined()
  })
})
