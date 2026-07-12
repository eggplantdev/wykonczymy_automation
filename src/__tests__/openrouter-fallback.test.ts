import { describe, it, expect, vi, beforeEach } from 'vitest'

// Guards the runtime auto-fallback: the primary RECEIPT_MODEL is a cheaper on-trial tier, so a
// wrong/unavailable id must degrade to the known-good FALLBACK_MODEL instead of failing the scan.

const { generateObject } = vi.hoisted(() => ({ generateObject: vi.fn() }))

vi.mock('ai', () => ({ generateObject }))

// createOpenRouter returns a factory; tag each model call so the mock can tell primary from fallback.
vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: () => (model: string) => ({ __model: model }),
}))

import {
  extractReceipt,
  RECEIPT_MODEL,
  FALLBACK_MODEL,
  RECEIPT_TIMEOUT_MS,
} from '@/lib/ai/openrouter'

const OK = {
  description: 'Castorama 05.03.2026',
  amount: 42,
  invoiceNote: '',
  otherCategoryName: '',
}
const BYTES = new Uint8Array([1, 2, 3])

beforeEach(() => vi.clearAllMocks())

describe('extractReceipt runtime fallback', () => {
  it('retries with FALLBACK_MODEL when the primary throws, returning the fallback result', async () => {
    generateObject.mockImplementation(async ({ model }: { model: { __model: string } }) => {
      if (model.__model === RECEIPT_MODEL) throw new Error('model not found')
      return { object: OK }
    })

    const result = await extractReceipt(BYTES, 'image/png', 'r.png', [])

    expect(result).toEqual(OK)
    expect(generateObject).toHaveBeenCalledTimes(2)
    expect(generateObject.mock.calls[0]?.[0].model.__model).toBe(RECEIPT_MODEL)
    expect(generateObject.mock.calls[1]?.[0].model.__model).toBe(FALLBACK_MODEL)
  })

  it('does not call the fallback when the primary succeeds', async () => {
    generateObject.mockResolvedValue({ object: OK })

    const result = await extractReceipt(BYTES, 'image/png', 'r.png', [])

    expect(result).toEqual(OK)
    expect(generateObject).toHaveBeenCalledTimes(1)
  })

  it('throws when both the primary and the fallback fail', async () => {
    generateObject.mockRejectedValue(new Error('provider down'))

    await expect(extractReceipt(BYTES, 'image/png', 'r.png', [])).rejects.toThrow()
    expect(generateObject).toHaveBeenCalledTimes(2)
  })

  // Regression guard: a hung vision request must abort (not hang forever), otherwise the batch
  // fill's Promise.all wedges and isFilling never clears (spinner stuck). Both attempts hang
  // until their own abortSignal fires; advancing past each timeout must reject.
  it('aborts a hung request via the per-attempt timeout instead of hanging forever', async () => {
    vi.useFakeTimers()
    try {
      generateObject.mockImplementation(
        ({ abortSignal }: { abortSignal: AbortSignal }) =>
          new Promise((_, reject) => {
            abortSignal.addEventListener('abort', () =>
              reject(abortSignal.reason ?? new Error('aborted')),
            )
          }),
      )

      let settled = false
      const p = extractReceipt(BYTES, 'image/png', 'r.png', [])
      p.catch(() => {}).finally(() => (settled = true)) // silence unhandled-rejection; track settlement

      await vi.advanceTimersByTimeAsync(RECEIPT_TIMEOUT_MS - 1)
      expect(settled).toBe(false) // still pending: only the timeout, not a synchronous throw, ends it
      expect(generateObject.mock.calls[0]?.[0].abortSignal).toBeInstanceOf(AbortSignal)

      await vi.advanceTimersByTimeAsync(2) // primary times out → fallback fires
      await vi.advanceTimersByTimeAsync(RECEIPT_TIMEOUT_MS) // fallback times out → reject

      await expect(p).rejects.toThrow()
      expect(generateObject).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
