import { describe, it, expect } from 'vitest'
import { receiptExtractionSchema } from '@/lib/ai/receipt-extraction-schema'

const VALID = {
  description: 'x',
  amount: 129.99,
  netAmount: null,
  invoiceNote: '',
  otherCategoryName: '',
  documentNumber: '',
  sellerNip: '',
  documentDate: '',
}

const without = (key: keyof typeof VALID) =>
  Object.fromEntries(Object.entries(VALID).filter(([field]) => field !== key))

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

  it.each([
    {
      name: 'rejects a missing amount key (must be number or null, never absent)',
      input: without('amount'),
    },
    {
      name: 'rejects a missing netAmount key (must be number or null, never absent)',
      input: { ...without('netAmount'), amount: 1 },
    },
    {
      name: 'rejects a string amount (no coercion — model must return a number)',
      input: { ...VALID, amount: '129.99' },
    },
    {
      name: 'rejects a string netAmount (no coercion — model must return a number)',
      input: { ...VALID, netAmount: '105.68' },
    },
  ])('$name', ({ input }) => {
    expect(receiptExtractionSchema.safeParse(input).success).toBe(false)
  })
})
