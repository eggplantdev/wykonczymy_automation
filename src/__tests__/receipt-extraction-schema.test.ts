import { describe, it, expect } from 'vitest'
import { receiptExtractionSchema } from '@/lib/ai/receipt-extraction-schema'

describe('receiptExtractionSchema', () => {
  it('accepts a fully-populated extraction', () => {
    const parsed = receiptExtractionSchema.parse({
      description: 'Castorama — farba',
      amount: 129.99,
      invoiceNote: 'FV/2026/07/11',
      expenseCategoryName: 'Materiały',
    })
    expect(parsed.amount).toBe(129.99)
    expect(parsed.expenseCategoryName).toBe('Materiały')
  })

  it('allows amount to be null (total not legible)', () => {
    const parsed = receiptExtractionSchema.parse({
      description: 'paragon',
      amount: null,
      invoiceNote: '',
      expenseCategoryName: '',
    })
    expect(parsed.amount).toBeNull()
  })

  it('rejects a missing amount key (must be number or null, never absent)', () => {
    const result = receiptExtractionSchema.safeParse({
      description: 'x',
      invoiceNote: '',
      expenseCategoryName: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a string amount (no coercion — model must return a number)', () => {
    const result = receiptExtractionSchema.safeParse({
      description: 'x',
      amount: '129.99',
      invoiceNote: '',
      expenseCategoryName: '',
    })
    expect(result.success).toBe(false)
  })
})
