import { describe, it, expect } from 'vitest'
import { isOfferedForBooking, type InvestmentStatusT } from '@/lib/constants/investment-status'

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
