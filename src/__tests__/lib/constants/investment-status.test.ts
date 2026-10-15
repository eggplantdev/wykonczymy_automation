import { describe, it, expect } from 'vitest'
import { INVESTMENT_STATUSES, isOfferedForBooking } from '@/lib/constants/investment-status'

// `isOfferedForBooking` takes a plain string, so no typecheck makes a new status take a side — the
// row it is missing here is what fails.
describe('isOfferedForBooking', () => {
  const OFFERED = {
    quote: false,
    planowana: true,
    active: true,
    completed: false,
    rejected: false,
    szablon: false,
  }

  it('has a row for every status', () => {
    expect(Object.keys(OFFERED).sort()).toEqual([...INVESTMENT_STATUSES].sort())
  })

  it.each(Object.entries(OFFERED))('%s → %s', (status, offered) => {
    expect(isOfferedForBooking({ status })).toBe(offered)
  })
})
