import { describe, expect, it } from 'vitest'
import { formatNet, formatPercent, formatPercentPrecise } from '@/lib/kosztorys/format'

describe('formatPercent / formatPercentPrecise', () => {
  it('fraction → percent; integer for the grid, one decimal for the headline', () => {
    expect(formatPercent(0.75)).toBe('75%')
    expect(formatPercentPrecise(0.746)).toBe('74,6%') // pl-PL comma
  })

  it('rounds rather than truncates', () => {
    expect(formatPercent(0.756)).toBe('76%')
    expect(formatPercentPrecise(0.7456)).toBe('74,6%')
  })

  it('no denominator (null) → dash, never 0%', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercentPrecise(null)).toBe('—')
  })

  it('zero is a real 0%, not a dash', () => {
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercentPrecise(0)).toBe('0,0%')
  })

  it('overshoot past 100% shows literally', () => {
    expect(formatPercent(1.2)).toBe('120%')
  })

  // REGRESSION (owner, 2026-10-13): 14,30 done against 14,25 agreed is 100,35% — a red overrun cell
  // that printed „100%", so the red read as a false alarm.
  it('an overrun never prints as 100%', () => {
    expect(formatPercent(14.3 / 14.25)).toBe('100,4%')
    expect(formatPercent(63.3 / 63.25)).toBe('100,1%')
    expect(formatPercent(1.0001)).toBe('100,1%')
    expect(formatPercentPrecise(1.0001)).toBe('100,1%')
  })

  it('exactly 100% stays a whole 100%', () => {
    expect(formatPercent(1)).toBe('100%')
    expect(formatPercentPrecise(1)).toBe('100,0%')
  })
})

// REGRESSION (`change.md` bug 3): a settlement that cancels out lands on a residue like −7e-12, not
// on 0. `toLocaleString` rounds that to „0,00" but keeps its sign, so a fully settled investment
// announced „-0,00 zł" — and „Wpłaty" reached it as a negated 0 for the same reason.
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
