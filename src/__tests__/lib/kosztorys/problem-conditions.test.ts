import { describe, expect, it } from 'vitest'

import { hasLatchingCondition } from '@/lib/kosztorys/problem-conditions'

describe('hasLatchingCondition', () => {
  it('latches an engaged Filtry condition, so an edited row stays in the grid', () => {
    expect(hasLatchingCondition(new Set(['no-planned-qty']))).toBe(true)
  })

  it('ignores ids that are not engaged', () => {
    expect(hasLatchingCondition(new Set())).toBe(false)
  })
})
