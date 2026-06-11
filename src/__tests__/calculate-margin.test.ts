import { describe, it, expect } from 'vitest'
import { calculateMargin } from '@/lib/calculate-margin'

describe('calculateMargin', () => {
  it('is labour minus payouts when there is no rabat', () => {
    expect(calculateMargin(5000, 1000)).toBe(4000)
  })

  it('subtracts the rabat from the margin', () => {
    expect(calculateMargin(5000, 1000, 800)).toBe(3200)
  })

  it('defaults rabat to 0 when omitted', () => {
    expect(calculateMargin(5000, 1000, undefined)).toBe(4000)
  })

  it('subtracts the loss from the margin', () => {
    expect(calculateMargin(5000, 1000, 0, 700)).toBe(3300)
  })

  it('subtracts both rabat and loss', () => {
    expect(calculateMargin(5000, 1000, 800, 700)).toBe(2500)
  })
})
