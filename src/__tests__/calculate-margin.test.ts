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

  it('subtracts settled internal material from margin', () => {
    // robocizna 500, payouts 0, rabat 0, loss 0, settled 100 → 400
    expect(calculateMargin(500, 0, 0, 0, 100)).toBe(400)
  })

  it('defaults settled to 0 (existing callers unaffected)', () => {
    expect(calculateMargin(500, 0, 0, 0)).toBe(500)
  })
})
