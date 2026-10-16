import { describe, it, expect } from 'vitest'
import { CACHE_TAGS, KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { KOSZTORYS_CLIENT_TOTALS_TAGS } from '@/lib/queries/balances'

describe('kosztorys client-totals cache tags', () => {
  it('subscribes to exactly the collections the figures are built from', () => {
    // Derived from the source it guards, this assertion would agree with any future edit,
    // including one that drops a tag.
    expect([...KOSZTORYS_CLIENT_TOTALS_TAGS].sort()).toEqual(
      [
        'collection:investments',
        'collection:kosztorys-items',
        'collection:kosztorys-sections',
        'collection:kosztorys-stages',
        'collection:stage-progress',
      ].sort(),
    )
  })

  it('covers every tag a whole-tree replacement invalidates', () => {
    for (const key of KOSZTORYS_TREE_TAGS) {
      expect(KOSZTORYS_CLIENT_TOTALS_TAGS).toContain(CACHE_TAGS[key])
    }
  })
})
