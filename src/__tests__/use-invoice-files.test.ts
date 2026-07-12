import { describe, it, expect } from 'vitest'
import { reindexAfterRemoval, setFilesAt } from '@/components/forms/hooks/use-invoice-files'

// Stand-in for File — the map algebra only ever reads identity, never File internals.
const file = (name: string) => ({ name }) as File

describe('setFilesAt', () => {
  it('registers N files at N consecutive indices from startIndex', () => {
    const map = new Map<number, File>()
    setFilesAt(map, 0, [file('a.jpg'), file('b.jpg'), file('c.jpg')])
    expect([...map.keys()]).toEqual([0, 1, 2])
    expect(map.get(1)?.name).toBe('b.jpg')
  })

  it('appends after existing rows without disturbing them', () => {
    const map = new Map<number, File>([[0, file('existing.jpg')]])
    setFilesAt(map, 1, [file('a.jpg'), file('b.jpg')])
    expect([...map.keys()]).toEqual([0, 1, 2])
    expect(map.get(0)?.name).toBe('existing.jpg')
  })
})

describe('reindexAfterRemoval', () => {
  it('re-aligns remaining files after a middle row is removed', () => {
    const map = new Map<number, File>([
      [0, file('a.jpg')],
      [1, file('b.jpg')],
      [2, file('c.jpg')],
    ])
    const next = reindexAfterRemoval(map, 1)
    expect([...next.keys()]).toEqual([0, 1])
    expect(next.get(0)?.name).toBe('a.jpg')
    expect(next.get(1)?.name).toBe('c.jpg')
  })

  it('drops the removed index and leaves a gap-free map when the last row goes', () => {
    const map = new Map<number, File>([
      [0, file('a.jpg')],
      [1, file('b.jpg')],
    ])
    const next = reindexAfterRemoval(map, 1)
    expect([...next.keys()]).toEqual([0])
    expect(next.get(0)?.name).toBe('a.jpg')
  })

  it('preserves a sparse map (row with no file) while shifting indices down', () => {
    const map = new Map<number, File>([
      [0, file('a.jpg')],
      [2, file('c.jpg')],
    ])
    const next = reindexAfterRemoval(map, 1)
    expect([...next.keys()]).toEqual([0, 1])
    expect(next.get(1)?.name).toBe('c.jpg')
  })
})
