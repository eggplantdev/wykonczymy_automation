import { describe, it, expect, vi, beforeEach } from 'vitest'

// The receipt scan is byte-in / persist-nothing: scanReceipt takes the picked Files, hands the
// model their BYTES, and creates NO media record — media is persisted only at submit. This pins
// that contract; the orphaned-media bug came from persisting a file during the scan that was then
// never linked to an expense (row removed, receipt swapped, form abandoned).

const { extractReceiptSpy, getPayloadSpy } = vi.hoisted(() => ({
  extractReceiptSpy: vi.fn(),
  getPayloadSpy: vi.fn(),
}))

// Persistence in this app runs exclusively through a Payload instance, so a spy that never fires
// is the whole storage surface staying untouched.
vi.mock('payload', () => ({ getPayload: getPayloadSpy }))

vi.mock('@/lib/ai/openrouter', () => ({
  extractReceipt: extractReceiptSpy,
}))

import { scanReceipt, scanReceiptPages } from '@/lib/ai/scan-receipt'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])

function receiptFile(name = 'receipt-x.png') {
  return new File([PNG_BYTES], name, { type: 'image/png' })
}

beforeEach(() => {
  vi.clearAllMocks()
  extractReceiptSpy.mockResolvedValue({
    description: 'Castorama',
    amount: 12.5,
    netAmount: 10.16,
    invoiceNote: '',
    otherCategoryName: '',
  })
})

async function scanWith(overrides: Record<string, unknown>) {
  extractReceiptSpy.mockResolvedValue({
    description: 'Castorama',
    amount: 12.5,
    netAmount: null,
    invoiceNote: '',
    otherCategoryName: '',
    ...overrides,
  })
  const result = await scanReceipt([receiptFile()], [])
  return result.netAmount
}

describe('scanReceipt', () => {
  it('passes the File BYTES (not a URL) to the model', async () => {
    await scanReceipt([receiptFile()], [])

    const [pages] = extractReceiptSpy.mock.calls[0] ?? []
    expect(pages).toHaveLength(1)
    expect(pages[0].bytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(pages[0].bytes as Uint8Array)).toEqual(Array.from(PNG_BYTES))
    expect(pages[0].mediaType).toBe('image/png')
    expect(pages[0].filename).toBe('receipt-x.png')
  })

  // One invoice photographed across several pages is ONE model call — a total printed on the last
  // page has to be found, and page order is the document's reading order.
  it('hands every page of one invoice to a single call, in order', async () => {
    await scanReceipt([receiptFile('page-1.png'), receiptFile('page-2.png')], [])

    expect(extractReceiptSpy).toHaveBeenCalledTimes(1)
    const [pages] = extractReceiptSpy.mock.calls[0] ?? []
    expect(pages.map((page: { filename: string }) => page.filename)).toEqual([
      'page-1.png',
      'page-2.png',
    ])
  })

  it('writes nothing to storage during a scan', async () => {
    await scanReceipt([receiptFile(), receiptFile('page-2.png')], [])

    expect(getPayloadSpy).not.toHaveBeenCalled()
  })

  it('returns an Opis-based filename for the client to apply at submit', async () => {
    const result = await scanReceipt([receiptFile()], [])

    expect(result.filename).toBeTruthy()
    // Derived from the extracted Opis, not the original upload name.
    expect(result.filename).not.toBe('receipt-x.png')
  })

  it('keeps the original name (no rename) when the receipt is unreadable', async () => {
    const { UNREADABLE_RECEIPT } = await import('@/lib/ai/receipt-extraction-schema')
    extractReceiptSpy.mockResolvedValue({
      description: UNREADABLE_RECEIPT,
      amount: null,
      netAmount: null,
      invoiceNote: '',
      otherCategoryName: '',
    })

    const result = await scanReceipt([receiptFile()], [])

    expect(result.filename).toBeUndefined()
  })

  // The netto sanity guard mirrors getNetAmountError's range rule: a netto the form would reject
  // becomes a blank field rather than a red error on a number the user never typed.
  describe('netto sanity guard', () => {
    it('passes a plausible netto through untouched', async () => {
      expect(await scanWith({ amount: 12.5, netAmount: 10.16 })).toBe(10.16)
    })

    it('nulls a netto above the brutto', async () => {
      expect(await scanWith({ amount: 12.5, netAmount: 15 })).toBeNull()
    })

    it('nulls a non-positive netto', async () => {
      expect(await scanWith({ amount: 12.5, netAmount: 0 })).toBeNull()
    })

    // VAT-exempt / reverse-charge invoices genuinely print netto == brutto, and
    // getNetAmountError permits it — discarding it as a suspected echo would contradict the form.
    it('keeps a netto equal to the brutto', async () => {
      expect(await scanWith({ amount: 12.5, netAmount: 12.5 })).toBe(12.5)
    })

    // No brutto to compare against; the user types that one, so the netto is not second-guessed.
    it('keeps a netto when the brutto is null', async () => {
      expect(await scanWith({ amount: null, netAmount: 10.16 })).toBe(10.16)
    })

    it('leaves a null netto null', async () => {
      expect(await scanWith({ amount: 12.5, netAmount: null })).toBeNull()
    })
  })
})

// The server read of a worker's draft already holds the bytes, and must shape the answer exactly
// as the form's scan does — same Opis-based name, same netto drop.
describe('scanReceiptPages', () => {
  it('shapes pages it is handed the way scanReceipt shapes picked files', async () => {
    extractReceiptSpy.mockResolvedValue({
      description: 'Castorama',
      amount: 12.5,
      netAmount: 20,
      invoiceNote: '',
      otherCategoryName: '',
    })
    const pages = [{ bytes: PNG_BYTES, mediaType: 'image/png', filename: 'photo-1.png' }]

    const result = await scanReceiptPages(pages, [])

    expect(extractReceiptSpy).toHaveBeenCalledWith(pages, [])
    expect(result).toMatchObject({ filename: 'castorama.png', netAmount: null })
  })
})
