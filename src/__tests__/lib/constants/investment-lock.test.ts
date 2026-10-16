import { describe, it, expect } from 'vitest'
import {
  isBookableInvestment,
  isLockedStatus,
  isOfferedForBooking,
} from '@/lib/constants/investment-lock'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'

// `isBookableInvestment` takes a plain string, so no typecheck guards it against a new status —
// this spec is the guard. „szablon" is bookable here ON PURPOSE (fetchReferenceData drops it before
// any picker sees it); folding that logic in here once broke sheet-linking for zakończone inwestycje.
describe('investment status gates', () => {
  it.each([
    ['active', true, false],
    ['planowana', true, false],
    ['quote', true, false],
    ['completed', false, true],
    ['rejected', true, false],
    ['szablon', true, false],
  ] as const)('%s: bookable=%s locked=%s', (status, bookable, locked) => {
    expect(isBookableInvestment({ status })).toBe(bookable)
    expect(isLockedStatus(status)).toBe(locked)
  })
})

describe('isOfferedForBooking', () => {
  const OFFERED = {
    quote: false,
    planowana: true,
    active: true,
    completed: false,
    rejected: false,
    szablon: false,
  }

  it.each(Object.entries(OFFERED) as [InvestmentStatusT, boolean][])(
    '%s → %s',
    (status, offered) => {
      expect(isOfferedForBooking({ status })).toBe(offered)
    },
  )
})
