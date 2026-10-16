import { describe, expect, it } from 'vitest'

import { engagedLatchingIds } from '@/lib/kosztorys/problem-conditions'

describe('engagedLatchingIds', () => {
  it('latches an engaged Filtry condition, so an edited row stays in the grid', () => {
    expect(engagedLatchingIds(new Set(['no-planned-qty']))).toEqual(new Set(['no-planned-qty']))
  })

  it('ignores ids that are not engaged', () => {
    expect(engagedLatchingIds(new Set())).toEqual(new Set())
  })
})
