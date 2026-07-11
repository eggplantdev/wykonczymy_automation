import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression guard for the relative-URL → base64 bug (EX-449 context): media.url is a
// RELATIVE path on the local Payload route (`/api/media/file/…`). The old code handed that
// string straight to the vision model, which mis-encoded it as base64 → OpenAI 400
// (invalid_base64 / invalid_image_format). The fix resolves it to an absolute URL, fetches
// the file, and sends the model BYTES. These tests pin that behavior.

const { findByID, extractReceiptSpy } = vi.hoisted(() => ({
  findByID: vi.fn(),
  extractReceiptSpy: vi.fn(),
}))

// Bypass auth/payload wiring: run the handler directly with a stub payload.
vi.mock('@/lib/actions/run-action', () => ({
  protectedAction: (_label: string, handler: (ctx: { payload: unknown }) => unknown) =>
    handler({ payload: { findByID } }),
}))

vi.mock('@/lib/ai/openrouter', () => ({
  extractReceipt: extractReceiptSpy,
}))

vi.mock('next/headers', () => ({
  headers: async () => new Map([['host', 'localhost:3000']]),
}))

import { extractReceiptAction } from '@/lib/actions/extract-receipt'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])

beforeEach(() => {
  vi.clearAllMocks()
  extractReceiptSpy.mockResolvedValue({
    description: 'Castorama',
    amount: 12.5,
    invoiceNote: '',
    expenseCategoryName: 'Materiały budowlane',
    otherCategoryName: '',
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => PNG_BYTES.buffer })),
  )
})

describe('extractReceiptAction', () => {
  it('resolves a relative media.url against the request origin before fetching', async () => {
    findByID.mockResolvedValue({ url: '/api/media/file/receipt-x.png', mimeType: 'image/png' })

    await extractReceiptAction({
      mediaId: 1,
      expenseCategoryNames: ['Materiały budowlane'],
      otherCategoryNames: [],
    })

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/media/file/receipt-x.png')
  })

  it('passes image BYTES to the model, not the URL string', async () => {
    findByID.mockResolvedValue({ url: '/api/media/file/receipt-x.png', mimeType: 'image/png' })

    const result = await extractReceiptAction({
      mediaId: 1,
      expenseCategoryNames: ['A'],
      otherCategoryNames: [],
    })

    expect(result.success).toBe(true)
    const firstArg = extractReceiptSpy.mock.calls[0]?.[0]
    expect(firstArg).toBeInstanceOf(Uint8Array)
    expect(Array.from(firstArg as Uint8Array)).toEqual(Array.from(PNG_BYTES))
  })

  it('fails cleanly when the file cannot be fetched', async () => {
    findByID.mockResolvedValue({ url: '/api/media/file/gone.png', mimeType: 'image/png' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) })),
    )

    const result = await extractReceiptAction({
      mediaId: 1,
      expenseCategoryNames: [],
      otherCategoryNames: [],
    })

    expect(result.success).toBe(false)
    expect(extractReceiptSpy).not.toHaveBeenCalled()
  })
})
