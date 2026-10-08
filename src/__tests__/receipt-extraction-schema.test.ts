import { describe, it, expect } from 'vitest'
import { receiptExtractionSchema } from '@/lib/ai/receipt-extraction-schema'

describe('receiptExtractionSchema', () => {
  it('accepts a fully-populated extraction', () => {
    const parsed = receiptExtractionSchema.parse({
      description: 'Castorama — farba',
      amount: 129.99,
      netAmount: 105.68,
      invoiceNote: 'FV/2026/07/11',
      otherCategoryName: 'Remont',
      documentNumber: '',
      sellerNip: '',
      documentDate: '',
    })
    expect(parsed.amount).toBe(129.99)
    expect(parsed.netAmount).toBe(105.68)
    expect(parsed.otherCategoryName).toBe('Remont')
  })

  it('allows amount to be null (total not legible)', () => {
    const parsed = receiptExtractionSchema.parse({
      description: 'paragon',
      amount: null,
      netAmount: null,
      invoiceNote: '',
      otherCategoryName: '',
      documentNumber: '',
      sellerNip: '',
      documentDate: '',
    })
    expect(parsed.amount).toBeNull()
  })

  it('allows netAmount to be null (document prints no netto)', () => {
    const parsed = receiptExtractionSchema.parse({
      description: 'paragon',
      amount: 129.99,
      netAmount: null,
      invoiceNote: '',
      otherCategoryName: '',
      documentNumber: '',
      sellerNip: '',
      documentDate: '',
    })
    expect(parsed.netAmount).toBeNull()
  })

  it('rejects a missing amount key (must be number or null, never absent)', () => {
    const result = receiptExtractionSchema.safeParse({
      description: 'x',
      netAmount: null,
      invoiceNote: '',
      otherCategoryName: '',
      documentNumber: '',
      sellerNip: '',
      documentDate: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing netAmount key (must be number or null, never absent)', () => {
    const result = receiptExtractionSchema.safeParse({
      description: 'x',
      amount: 1,
      invoiceNote: '',
      otherCategoryName: '',
      documentNumber: '',
      sellerNip: '',
      documentDate: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a string amount (no coercion — model must return a number)', () => {
    const result = receiptExtractionSchema.safeParse({
      description: 'x',
      amount: '129.99',
      netAmount: null,
      invoiceNote: '',
      otherCategoryName: '',
      documentNumber: '',
      sellerNip: '',
      documentDate: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a string netAmount (no coercion — model must return a number)', () => {
    const result = receiptExtractionSchema.safeParse({
      description: 'x',
      amount: 129.99,
      netAmount: '105.68',
      invoiceNote: '',
      otherCategoryName: '',
      documentNumber: '',
      sellerNip: '',
      documentDate: '',
    })
    expect(result.success).toBe(false)
  })
})
