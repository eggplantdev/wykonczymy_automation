import { describe, it, expect } from 'vitest'

import { filesByRowId, positionalFiles } from '@/components/forms/expense-form/row-file-positions'

// Stand-in for File — the projections only ever read row `id` and Map identity, never File internals.
const file = (name: string) => ({ name }) as File
const pages = (...names: string[]) => names.map(file)
const row = (id: string) => ({ id })

describe('positionalFiles (id-space → position-space, submit boundary)', () => {
  it('aligns each row-id file onto that row’s position', () => {
    const byId = new Map<string, File[]>([
      ['a', pages('a.jpg', 'a2.jpg')],
      ['b', pages('b.jpg')],
    ])
    const result = positionalFiles([row('a'), row('b')], byId)

    expect([...result.keys()]).toEqual([0, 1])
    expect(result.get(0)?.map((f) => f.name)).toEqual(['a.jpg', 'a2.jpg'])
    expect(result.get(1)?.map((f) => f.name)).toEqual(['b.jpg'])
  })

  it('leaves a row with no attached file out of the positional map (→ undefined on resolve)', () => {
    const byId = new Map<string, File[]>([['b', pages('b.jpg')]])
    const result = positionalFiles([row('a'), row('b'), row('c')], byId)

    expect(result.has(0)).toBe(false)
    expect(result.get(1)?.map((f) => f.name)).toEqual(['b.jpg'])
    expect(result.has(2)).toBe(false)
  })

  it('skips a stale id in the map that no longer matches any row', () => {
    const byId = new Map<string, File[]>([['ghost', pages('ghost.jpg')]])
    const result = positionalFiles([row('a')], byId)

    expect(result.size).toBe(0)
  })
})

describe('filesByRowId (position-space → id-space, recovery boundary)', () => {
  it('re-keys a recovered positional map onto the recovered rows’ ids', () => {
    const positional = new Map<number, File[]>([
      [0, pages('a.jpg', 'a2.jpg')],
      [1, pages('c.jpg')],
    ])
    const result = filesByRowId([row('a'), row('c')], positional)

    expect(result.get('a')?.map((f) => f.name)).toEqual(['a.jpg', 'a2.jpg'])
    expect(result.get('c')?.map((f) => f.name)).toEqual(['c.jpg'])
  })

  it('drops a position with no file rather than binding an id to undefined', () => {
    const positional = new Map<number, File[]>([[1, pages('b.jpg')]])
    const result = filesByRowId([row('a'), row('b')], positional)

    expect(result.has('a')).toBe(false)
    expect(result.get('b')?.map((f) => f.name)).toEqual(['b.jpg'])
  })

  it('round-trips: id → position → id preserves every row’s file', () => {
    const byId = new Map<string, File[]>([
      ['a', pages('a.jpg', 'a2.jpg')],
      ['b', pages('b.jpg')],
    ])
    const rows = [row('a'), row('b')]

    const back = filesByRowId(rows, positionalFiles(rows, byId))

    expect(back.get('a')?.map((f) => f.name)).toEqual(['a.jpg', 'a2.jpg'])
    expect(back.get('b')?.map((f) => f.name)).toEqual(['b.jpg'])
  })
})

describe('remove-mid-batch id stability (EX-448 regression guard)', () => {
  it('keeps surviving rows bound to their own files after a middle row is removed', () => {
    const byId = new Map<string, File[]>([
      ['a', pages('a.jpg')],
      ['b', pages('b.jpg')],
      ['c', pages('c.jpg')],
    ])

    byId.delete('b')
    const rowsAfterRemoval = [row('a'), row('c')]

    const positional = positionalFiles(rowsAfterRemoval, byId)

    expect(positional.get(0)?.map((f) => f.name)).toEqual(['a.jpg'])
    expect(positional.get(1)?.map((f) => f.name)).toEqual(['c.jpg'])
    expect(positional.size).toBe(2)
  })
})
