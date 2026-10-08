import { describe, expect, it } from 'vitest'
import { sanitizeReceiptExtraction } from '@/lib/ai/extract-receipt-sanitize'
import type { ReceiptExtractionT } from '@/lib/ai/receipt-extraction-schema'
import { COMPANY_NIPS } from '@/lib/constants/company'

const read = (overrides: Partial<ReceiptExtractionT> = {}): ReceiptExtractionT => ({
  description: 'Castorama 05.03.2026',
  amount: 129.99,
  netAmount: null,
  invoiceNote: 'FV 123/2026\nCement 25kg',
  otherCategoryName: '',
  documentNumber: 'FV 123/2026',
  sellerNip: 'PL 521-345-67-89',
  documentDate: '2026-03-05',
  ...overrides,
})

describe('sanitizeReceiptExtraction', () => {
  it('normalises the seller NIP and keeps a valid date and number', () => {
    expect(sanitizeReceiptExtraction(read())).toMatchObject({
      documentNumber: 'FV 123/2026',
      sellerNip: '5213456789',
      documentDate: '2026-03-05',
    })
  })

  it.each(COMPANY_NIPS)('drops our own NIP %s — the buyer, not the seller', (nip) => {
    expect(sanitizeReceiptExtraction(read({ sellerNip: `PL${nip}` })).sellerNip).toBe('')
  })

  it('drops a NIP that is not 10 digits', () => {
    expect(sanitizeReceiptExtraction(read({ sellerNip: '52134567' })).sellerNip).toBe('')
  })

  it.each(['05.03.2026', '2026-02-30', '2026-3-5', 'brak'])('drops the invalid date %j', (date) => {
    expect(sanitizeReceiptExtraction(read({ documentDate: date })).documentDate).toBe('')
  })

  it('leaves every other field as the model read it', () => {
    const { description, amount, netAmount, invoiceNote } = sanitizeReceiptExtraction(read())
    expect({ description, amount, netAmount, invoiceNote }).toEqual({
      description: 'Castorama 05.03.2026',
      amount: 129.99,
      netAmount: null,
      invoiceNote: 'FV 123/2026\nCement 25kg',
    })
  })
})
