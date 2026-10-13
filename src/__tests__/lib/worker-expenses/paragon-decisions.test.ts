import { describe, expect, it } from 'vitest'
import type { RejectedReceiptT } from '@/lib/db/worker-expense-drafts'
import { paragonDecisions } from '@/lib/worker-expenses/paragon-decisions'

const refusalOf = (readRow: number) =>
  ({ id: readRow, readRow, mediaIds: [readRow] }) as RejectedReceiptT

const receipts = new Map([
  ['a', [{ readRow: 0, mediaIds: [1] }]],
  ['b', [{ readRow: 1, mediaIds: [1] }]],
  [
    'ab',
    [
      { readRow: 2, mediaIds: [2] },
      { readRow: 3, mediaIds: [3] },
    ],
  ],
  ['c', [{ readRow: 4, mediaIds: [4] }]],
])

describe('paragonDecisions', () => {
  it('marks booked rows accepted and refused rows rejected, leaving the rest waiting', () => {
    const decisions = paragonDecisions(receipts, {
      acceptedReadRows: [0, 2, 3],
      rejectedReceipts: [refusalOf(1)],
    })
    expect(Object.fromEntries(decisions)).toEqual({ a: 'accepted', ab: 'accepted', b: 'rejected' })
  })

  it('keeps a merged row waiting while one of its paragony is still open', () => {
    const decisions = paragonDecisions(receipts, { acceptedReadRows: [2] })
    expect(decisions.has('ab')).toBe(false)
  })

  it('decides nothing without outcomes', () => {
    expect(paragonDecisions(receipts, {}).size).toBe(0)
  })
})
