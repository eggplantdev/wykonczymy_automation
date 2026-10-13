import { describe, expect, it } from 'vitest'
import { orderedEntries } from '@/lib/worker-expenses/ordered-entries'

const items = [{ id: 'c' }, { id: 'none' }, { id: 'a' }, { id: 'b' }]

describe('orderedEntries', () => {
  it('keeps the form order without a read order', () => {
    expect(orderedEntries(items).map((entry) => entry.item.id)).toEqual(['c', 'none', 'a', 'b'])
  })

  it('orders by read row, unread rows last, keeping each row its form index', () => {
    const readRows: Record<string, number> = { a: 0, b: 0, c: 1 }
    const entries = orderedEntries(items, (id) => readRows[id])
    expect(entries.map((entry) => entry.item.id)).toEqual(['a', 'b', 'c', 'none'])
    expect(entries.map((entry) => entry.index)).toEqual([2, 3, 0, 1])
  })
})
