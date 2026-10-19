import { describe, expect, it } from 'vitest'

import { findCategoryIdByName } from '@/lib/orders/find-category-by-name'

const CATEGORIES = [
  { id: 3, name: 'Wywóz gruzu' },
  { id: 7, name: 'Big Bag 1 m³' },
  { id: 9, name: 'big bag duży' },
]

describe('findCategoryIdByName', () => {
  it('matches a fragment case-insensitively and takes the first hit in list order', () => {
    expect(findCategoryIdByName('big bag', CATEGORIES)).toBe('7')
  })

  it('trims the fragment', () => {
    expect(findCategoryIdByName('  wywóz  ', CATEGORIES)).toBe('3')
  })

  it('returns an empty id when nothing matches', () => {
    expect(findCategoryIdByName('kontener', CATEGORIES)).toBe('')
  })
})
