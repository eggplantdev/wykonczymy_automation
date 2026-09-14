import { describe, it, expect } from 'vitest'
import { isBookableInvestment, isLockedStatus } from '@/lib/constants/investment-lock'

// The two questions are deliberately separate: „zakończona" blocks edits, „szablon" blocks only
// bookings. `isBookableInvestment` takes a plain string, so no typecheck guards this pairing —
// this spec is the guard.
describe('investment status gates', () => {
  it.each([
    ['active', true, false],
    ['planowana', true, false],
    ['completed', false, true],
    ['szablon', false, false],
  ] as const)('%s: bookable=%s locked=%s', (status, bookable, locked) => {
    expect(isBookableInvestment({ status })).toBe(bookable)
    expect(isLockedStatus(status)).toBe(locked)
  })
})
