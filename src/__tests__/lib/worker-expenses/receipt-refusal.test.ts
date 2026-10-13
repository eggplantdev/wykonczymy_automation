import { describe, expect, it } from 'vitest'
import type { RejectedReceiptT } from '@/lib/db/worker-expense-drafts'
import { isReceiptOf } from '@/lib/worker-expenses/receipt-refusal'

const refusal = (overrides: Partial<RejectedReceiptT>): RejectedReceiptT =>
  ({ id: 1, readRow: null, mediaIds: [], ...overrides }) as RejectedReceiptT

describe('isReceiptOf', () => {
  it('matches a read paragon by its read row', () => {
    expect(isReceiptOf(refusal({ readRow: 2 }), { readRow: 2, mediaIds: [7] })).toBe(true)
    expect(isReceiptOf(refusal({ readRow: 2 }), { readRow: 3, mediaIds: [7] })).toBe(false)
  })

  it('matches an unread paragon by its photos', () => {
    expect(isReceiptOf(refusal({ mediaIds: [7] }), { readRow: undefined, mediaIds: [7, 8] })).toBe(
      true,
    )
    expect(isReceiptOf(refusal({ mediaIds: [9] }), { readRow: undefined, mediaIds: [7] })).toBe(
      false,
    )
  })

  it('never matches through a refusal that names no photos', () => {
    expect(isReceiptOf(refusal({ mediaIds: [] }), { readRow: undefined, mediaIds: [7] })).toBe(
      false,
    )
  })
})
