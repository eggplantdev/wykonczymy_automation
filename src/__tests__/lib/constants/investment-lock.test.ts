import { describe, it, expect } from 'vitest'
import { isBookableInvestment, isLockedStatus } from '@/lib/constants/investment-lock'

// `isBookableInvestment` takes a plain string, so no typecheck guards it against a new status —
// this spec is the guard. „szablon" is bookable here ON PURPOSE: the workbench never reaches a
// picker, because fetchReferenceData drops it at the source. Folding that into this predicate would
// make it answer two questions at once, which is how sheet-linking briefly stopped offering
// zakończone inwestycje.
describe('investment status gates', () => {
  it.each([
    ['active', true, false],
    ['planowana', true, false],
    ['completed', false, true],
    ['szablon', true, false],
  ] as const)('%s: bookable=%s locked=%s', (status, bookable, locked) => {
    expect(isBookableInvestment({ status })).toBe(bookable)
    expect(isLockedStatus(status)).toBe(locked)
  })
})
