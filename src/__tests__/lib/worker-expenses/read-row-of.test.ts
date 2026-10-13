import { describe, expect, it } from 'vitest'
import { readRowOf } from '@/lib/worker-expenses/read-row-of'

describe('readRowOf', () => {
  it('places a merged row at its earliest paragon', () => {
    expect(
      readRowOf([
        { readRow: 5, mediaIds: [1] },
        { readRow: 2, mediaIds: [2] },
      ]),
    ).toBe(2)
  })

  it('has no place for a row with no read', () => {
    expect(readRowOf([{ readRow: undefined, mediaIds: [1] }])).toBeUndefined()
    expect(readRowOf([])).toBeUndefined()
  })
})
