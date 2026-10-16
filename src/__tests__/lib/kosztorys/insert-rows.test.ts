import { describe, it, expect, vi, afterEach } from 'vitest'
import { remapNewIds } from '@/lib/kosztorys/insert-rows'

// The DB specs around restore can't fail on a reordered RETURNING, because Postgres doesn't reorder
// one today — revert the key join to `res.rows.map(r => r.id)` and every one of them stays green.

afterEach(() => {
  vi.restoreAllMocks()
})

describe('remapNewIds', () => {
  const keyOf = (row: Record<string, unknown>) => Number(row.display_order)

  it('returns ids in INPUT order when RETURNING comes back shuffled', () => {
    const returned = [
      { id: 300, display_order: 2 },
      { id: 100, display_order: 0 },
      { id: 200, display_order: 1 },
    ]

    expect(remapNewIds(returned, keyOf, [0, 1, 2], 'kosztorys_sections')).toEqual([100, 200, 300])
  })

  it('falls back to positional order when the natural key ties', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    const returned = [
      { id: 100, display_order: 0 },
      { id: 200, display_order: 0 },
    ]

    expect(remapNewIds(returned, keyOf, [0, 0], 'kosztorys_sections')).toEqual([100, 200])
    expect(warn).toHaveBeenCalledOnce()
  })

  it('throws when the INSERT returned fewer ids than rows sent', () => {
    expect(() =>
      remapNewIds([{ id: 100, display_order: 0 }], keyOf, [0, 1], 'kosztorys_items'),
    ).toThrow(/returned 1 ids for 2 rows/)
  })

  it('throws when a key has no returned row — a mismatch would misparent silently', () => {
    const returned = [
      { id: 100, display_order: 0 },
      { id: 200, display_order: 1 },
    ]

    expect(() => remapNewIds(returned, keyOf, [0, 7], 'kosztorys_items')).toThrow(
      /no id for natural key 7/,
    )
  })
})
