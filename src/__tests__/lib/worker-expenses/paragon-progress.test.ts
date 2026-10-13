import { describe, expect, it } from 'vitest'
import { paragonProgress } from '@/lib/worker-expenses/paragon-progress'

describe('paragonProgress', () => {
  it('counts read rows, so a merged row counts each paragon it holds', () => {
    const receipts = new Map([
      [
        'merged',
        [
          { readRow: 0, mediaIds: [1] },
          { readRow: 1, mediaIds: [2] },
        ],
      ],
      ['refused', [{ readRow: 2, mediaIds: [3] }]],
      ['open', [{ readRow: 3, mediaIds: [4] }]],
      ['unread', [{ readRow: undefined, mediaIds: [5] }]],
    ])
    const decisions = new Map([
      ['merged', 'accepted' as const],
      ['refused', 'rejected' as const],
    ])

    expect(paragonProgress(receipts, [...receipts.keys()], decisions)).toEqual({
      accepted: 2,
      rejected: 1,
      pending: 1,
    })
  })

  it('skips a row that is no longer in the form', () => {
    const receipts = new Map([['gone', [{ readRow: 0, mediaIds: [1] }]]])
    expect(paragonProgress(receipts, [], new Map())).toEqual({
      accepted: 0,
      rejected: 0,
      pending: 0,
    })
  })
})
