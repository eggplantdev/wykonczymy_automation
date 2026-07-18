import { describe, it, expect } from 'vitest'

import { filesByRowId, positionalFiles } from '@/lib/utils/upload-file-client'

// Stand-in for File — the projections only ever read row `id` and Map identity, never File internals.
const file = (name: string) => ({ name }) as File
const row = (id: string) => ({ id })

describe('positionalFiles (id-space → position-space, submit boundary)', () => {
  it('aligns each row-id file onto that row’s position', () => {
    const byId = new Map<string, File>([
      ['a', file('a.jpg')],
      ['b', file('b.jpg')],
    ])
    const result = positionalFiles([row('a'), row('b')], byId)

    expect([...result.keys()]).toEqual([0, 1])
    expect(result.get(0)?.name).toBe('a.jpg')
    expect(result.get(1)?.name).toBe('b.jpg')
  })

  it('leaves a row with no attached file out of the positional map (→ undefined on resolve)', () => {
    const byId = new Map<string, File>([['b', file('b.jpg')]])
    const result = positionalFiles([row('a'), row('b'), row('c')], byId)

    expect(result.has(0)).toBe(false)
    expect(result.get(1)?.name).toBe('b.jpg')
    expect(result.has(2)).toBe(false)
  })

  it('skips a stale id in the map that no longer matches any row', () => {
    const byId = new Map<string, File>([['ghost', file('ghost.jpg')]])
    const result = positionalFiles([row('a')], byId)

    expect(result.size).toBe(0)
  })
})

describe('filesByRowId (position-space → id-space, recovery boundary)', () => {
  it('re-keys a recovered positional map onto the recovered rows’ ids', () => {
    const positional = new Map<number, File>([
      [0, file('a.jpg')],
      [1, file('c.jpg')],
    ])
    const result = filesByRowId([row('a'), row('c')], positional)

    expect(result.get('a')?.name).toBe('a.jpg')
    expect(result.get('c')?.name).toBe('c.jpg')
  })

  it('drops a position with no file rather than binding an id to undefined', () => {
    const positional = new Map<number, File>([[1, file('b.jpg')]])
    const result = filesByRowId([row('a'), row('b')], positional)

    expect(result.has('a')).toBe(false)
    expect(result.get('b')?.name).toBe('b.jpg')
  })

  it('round-trips: id → position → id preserves every row’s file', () => {
    const byId = new Map<string, File>([
      ['a', file('a.jpg')],
      ['b', file('b.jpg')],
    ])
    const rows = [row('a'), row('b')]

    const back = filesByRowId(rows, positionalFiles(rows, byId))

    expect(back.get('a')?.name).toBe('a.jpg')
    expect(back.get('b')?.name).toBe('b.jpg')
  })
})

// The bug EX-448 exists to kill: identifying rows by array index meant removing a middle row
// shifted every later row's file onto the wrong slot. With id-keying, removing row B must leave
// A and C bound to their OWN files. This test would fail under the old index-shift model, where
// C's file would land in B's vacated position.
describe('remove-mid-batch id stability (EX-448 regression guard)', () => {
  it('keeps surviving rows bound to their own files after a middle row is removed', () => {
    const byId = new Map<string, File>([
      ['a', file('a.jpg')],
      ['b', file('b.jpg')],
      ['c', file('c.jpg')],
    ])

    // Remove B: the id map is untouched (the hook deletes only B's entry), and the row list loses B.
    byId.delete('b')
    const rowsAfterRemoval = [row('a'), row('c')]

    const positional = positionalFiles(rowsAfterRemoval, byId)

    expect(positional.get(0)?.name).toBe('a.jpg')
    // C, now at position 1, still resolves to C's file — NOT B's (which the old model would have
    // shifted into this slot).
    expect(positional.get(1)?.name).toBe('c.jpg')
    expect(positional.size).toBe(2)
  })
})
