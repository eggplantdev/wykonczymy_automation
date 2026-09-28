import { describe, expect, it } from 'vitest'

import { isRemainingOverrun } from '@/lib/kosztorys/settlement-rows'

describe('isRemainingOverrun', () => {
  // A row executed exactly to its przedmiar can land a hair under zero on float noise; that must
  // neither turn red nor drop out of the „Pozostało" total.
  it('treats anything within half a grosz of zero as not past the przedmiar', () => {
    expect(isRemainingOverrun(0)).toBe(false)
    expect(isRemainingOverrun(-0.004)).toBe(false)
    expect(isRemainingOverrun(-0.006)).toBe(true)
    expect(isRemainingOverrun(-800)).toBe(true)
  })
})
