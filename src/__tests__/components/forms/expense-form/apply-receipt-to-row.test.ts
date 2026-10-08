import { describe, it, expect, vi } from 'vitest'
import { applyReceiptToRow } from '@/components/forms/expense-form/apply-receipt-to-row'
import type { ReceiptFillResultT } from '@/lib/ai/scan-receipt'

function fill(overrides: Partial<ReceiptFillResultT> = {}): ReceiptFillResultT {
  return {
    description: 'Castorama 05.03.2026',
    amount: 12.5,
    netAmount: 10.16,
    invoiceNote: 'FV 123/2026',
    otherCategoryName: '',
    documentNumber: '',
    sellerNip: '',
    documentDate: '',
    ...overrides,
  }
}

function writesOf(data: ReceiptFillResultT, index = 2) {
  const setFieldValue = vi.fn()
  applyReceiptToRow(
    setFieldValue as unknown as Parameters<typeof applyReceiptToRow>[0],
    index,
    data,
  )
  return Object.fromEntries(setFieldValue.mock.calls)
}

describe('applyReceiptToRow', () => {
  it('writes the extracted netto onto the row', () => {
    expect(writesOf(fill())['lineItems[2].netAmount']).toBe('10.16')
  })

  it('writes a blank string when the document printed no netto', () => {
    expect(writesOf(fill({ netAmount: null }))['lineItems[2].netAmount']).toBe('')
  })

  it('still writes description, amount and the invoice note', () => {
    const writes = writesOf(fill())
    expect(writes['lineItems[2].description']).toBe('Castorama 05.03.2026')
    expect(writes['lineItems[2].amount']).toBe('12.5')
    expect(writes['lineItems[2].invoiceNote']).toBe('FV 123/2026')
  })

  it('blanks the amount when the total was unreadable', () => {
    expect(writesOf(fill({ amount: null }))['lineItems[2].amount']).toBe('')
  })
})
