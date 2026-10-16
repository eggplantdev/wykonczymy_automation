import { describe, expect, it } from 'vitest'
import { formatNet, formatPercent } from '@/lib/kosztorys/format'

describe('formatPercent', () => {
  it('fraction → percent with at most one decimal, none when it is zero', () => {
    expect(formatPercent(0.75)).toBe('75%')
    expect(formatPercent(0.746)).toBe('74,6%')
  })

  it('rounds rather than truncates', () => {
    expect(formatPercent(0.7456)).toBe('74,6%')
  })

  it('no denominator (null) → dash, never 0%', () => {
    expect(formatPercent(null)).toBe('—')
  })

  it('zero is a real 0%, not a dash', () => {
    expect(formatPercent(0)).toBe('0%')
  })

  it('overshoot past 100% shows literally', () => {
    expect(formatPercent(1.2)).toBe('120%')
  })

  it('an overrun never prints as 100%', () => {
    expect(formatPercent(14.3 / 14.25)).toBe('100,4%')
    expect(formatPercent(63.3 / 63.25)).toBe('100,1%')
    expect(formatPercent(1.0001)).toBe('100,1%')
  })

  it('a sliver short never prints as 100%', () => {
    expect(formatPercent(0.9996)).toBe('99,9%')
  })

  it('exactly 100% prints as 100%', () => {
    expect(formatPercent(1)).toBe('100%')
  })
})

describe('formatNet', () => {
  it('prints a settled-to-zero residue as „0,00", never „-0,00"', () => {
    expect(formatNet(-7e-12)).toBe('0,00')
    expect(formatNet(-0)).toBe('0,00')
    expect(formatNet(-0.004)).toBe('0,00')
  })

  it('still keeps the sign of a real debt', () => {
    expect(formatNet(-0.01)).toBe('-0,01')
    expect(formatNet(-1234.5)).toBe('-1234,50')
  })
})
