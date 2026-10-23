import { describe, expect, it } from 'vitest'

import { findIdByName } from '@/lib/orders/find-id-by-name'

const CATEGORIES = [
  { id: 3, name: 'Wywóz gruzu' },
  { id: 7, name: 'Big Bag 1 m³' },
  { id: 9, name: 'big bag duży' },
]

describe('findIdByName', () => {
  it('matches a fragment case-insensitively and takes the first hit in list order', () => {
    expect(findIdByName('big bag', CATEGORIES)).toBe('7')
  })

  it('trims the fragment', () => {
    expect(findIdByName('  wywóz  ', CATEGORIES)).toBe('3')
  })

  it('returns an empty id when nothing matches', () => {
    expect(findIdByName('kontener', CATEGORIES)).toBe('')
  })
})
