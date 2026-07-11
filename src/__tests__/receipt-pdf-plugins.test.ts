import { describe, it, expect } from 'vitest'
import { receiptPdfPlugins, RECEIPT_PDF_ENGINE } from '@/lib/ai/receipt-pdf-plugins'

describe('receiptPdfPlugins', () => {
  it('returns the free pdf-text file-parser plugin for a PDF', () => {
    // Pins the engine to the free `pdf-text` extractor — without this the OpenRouter default
    // silently falls back to the paid mistral-ocr ($2/1000 pages).
    expect(receiptPdfPlugins('application/pdf')).toEqual([
      { id: 'file-parser', pdf: { engine: 'pdf-text' } },
    ])
    expect(RECEIPT_PDF_ENGINE).toBe('pdf-text')
  })

  it('returns undefined for image types (plain vision call, no plugin)', () => {
    expect(receiptPdfPlugins('image/jpeg')).toBeUndefined()
    expect(receiptPdfPlugins('image/png')).toBeUndefined()
    expect(receiptPdfPlugins('image/heic')).toBeUndefined()
  })
})
