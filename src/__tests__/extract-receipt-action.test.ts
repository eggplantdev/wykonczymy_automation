import { describe, it, expect, vi, beforeEach } from 'vitest'

// The receipt scan is byte-in / persist-nothing: extractReceiptAction takes the picked File,
// hands the model its BYTES, and creates NO media record — media is persisted only at submit.
// This pins that contract; the orphaned-media bug came from persisting a file during the scan
// that was then never linked to an expense (row removed, receipt swapped, form abandoned).

const { extractReceiptSpy, payloadSpy } = vi.hoisted(() => ({
  extractReceiptSpy: vi.fn(),
  payloadSpy: { create: vi.fn(), update: vi.fn(), findByID: vi.fn() },
}))

// Bypass auth/payload wiring: run the handler directly with a spied payload so we can assert
// the scan never touches persistence.
vi.mock('@/lib/actions/run-action', () => ({
  protectedAction: (_label: string, handler: (ctx: { payload: unknown }) => unknown) =>
    handler({ payload: payloadSpy }),
}))

vi.mock('@/lib/ai/openrouter', () => ({
  extractReceipt: extractReceiptSpy,
}))

import { extractReceiptAction } from '@/lib/actions/extract-receipt'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])

function receiptFile() {
  return new File([PNG_BYTES], 'receipt-x.png', { type: 'image/png' })
}

beforeEach(() => {
  vi.clearAllMocks()
  extractReceiptSpy.mockResolvedValue({
    description: 'Castorama',
    amount: 12.5,
    invoiceNote: '',
    otherCategoryName: '',
  })
})

describe('extractReceiptAction', () => {
  it('passes the File BYTES (not a URL) to the model', async () => {
    const result = await extractReceiptAction({ file: receiptFile(), otherCategoryNames: [] })

    expect(result.success).toBe(true)
    const [bytes, mimeType, filename] = extractReceiptSpy.mock.calls[0] ?? []
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(bytes as Uint8Array)).toEqual(Array.from(PNG_BYTES))
    expect(mimeType).toBe('image/png')
    expect(filename).toBe('receipt-x.png')
  })

  it('writes nothing to storage during a scan', async () => {
    await extractReceiptAction({ file: receiptFile(), otherCategoryNames: [] })

    expect(payloadSpy.create).not.toHaveBeenCalled()
    expect(payloadSpy.update).not.toHaveBeenCalled()
    expect(payloadSpy.findByID).not.toHaveBeenCalled()
  })

  it('returns an Opis-based filename for the client to apply at submit', async () => {
    const result = await extractReceiptAction({ file: receiptFile(), otherCategoryNames: [] })

    expect(result.success && result.data.filename).toBeTruthy()
    // Derived from the extracted Opis, not the original upload name.
    expect(result.success && result.data.filename).not.toBe('receipt-x.png')
  })

  it('keeps the original name (no rename) when the receipt is unreadable', async () => {
    const { UNREADABLE_RECEIPT } = await import('@/lib/ai/receipt-extraction-schema')
    extractReceiptSpy.mockResolvedValue({
      description: UNREADABLE_RECEIPT,
      amount: null,
      invoiceNote: '',
      otherCategoryName: '',
    })

    const result = await extractReceiptAction({ file: receiptFile(), otherCategoryNames: [] })

    expect(result.success && result.data.filename).toBeUndefined()
  })
})
