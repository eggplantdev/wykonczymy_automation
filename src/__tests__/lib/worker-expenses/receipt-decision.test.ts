import { describe, expect, it } from 'vitest'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import { receiptDecision } from '@/lib/worker-expenses/receipt-decision'

const RECEIPTS = new Map<string, number[]>([
  ['a', [11, 12]],
  ['b', [21]],
  ['c', [31]],
])
const BOOKED: DuplicateOfT = { source: 'transaction', id: 4021 }

describe('receiptDecision', () => {
  it('books accepted receipts positionally and skips none of them', () => {
    const decision = receiptDecision(RECEIPTS, [{ id: 'c' }, { id: 'a' }, { id: 'b' }])

    expect(decision.receiptMediaIds).toEqual([[31], [11, 12], [21]])
    expect(decision.skippedReceipts).toEqual([])
  })

  it('carries duplicateOf on a receipt left out via „Duplikat"', () => {
    const decision = receiptDecision(RECEIPTS, [{ id: 'a' }, { id: 'c' }], new Map([['b', BOOKED]]))

    expect(decision.receiptMediaIds).toEqual([[11, 12], [31]])
    expect(decision.skippedReceipts).toEqual([{ mediaIds: [21], duplicateOf: BOOKED }])
  })

  it('skips a plainly removed receipt without a duplicateOf', () => {
    const decision = receiptDecision(
      RECEIPTS,
      [{ id: 'b' }],
      new Map([['a', { source: 'draft', id: 77 } satisfies DuplicateOfT]]),
    )

    expect(decision.skippedReceipts).toEqual([
      { mediaIds: [11, 12], duplicateOf: { source: 'draft', id: 77 } },
      { mediaIds: [31] },
    ])
    expect(decision.skippedReceipts[1]).not.toHaveProperty('duplicateOf')
  })

  it('ignores a duplicate mark on a receipt that was accepted after all', () => {
    const decision = receiptDecision(
      RECEIPTS,
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      new Map([['b', BOOKED]]),
    )

    expect(decision.skippedReceipts).toEqual([])
  })
})
