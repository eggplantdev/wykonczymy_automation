import { describe, it, expect } from 'vitest'
import { computeSummary, valueColor } from '@/components/ui/toggle-stat-buttons'

describe('valueColor', () => {
  it('returns green for positive values', () => {
    expect(valueColor(100)).toBe('var(--color-chart-green)')
  })

  it('returns green for zero', () => {
    expect(valueColor(0)).toBe('var(--color-chart-green)')
  })

  it('returns destructive for negative values', () => {
    expect(valueColor(-50)).toBe('var(--color-destructive)')
  })
})

describe('computeSummary', () => {
  const entries = [
    { label: 'A', value: '100 zł', amount: 100, borderColor: 'blue' },
    { label: 'B', value: '-50 zł', amount: -50, borderColor: 'red' },
    { label: 'C', value: '200 zł', amount: 200, borderColor: 'green' },
  ] as const

  it('sums all amounts when nothing is hidden', () => {
    const hidden = new Set<string>()
    expect(computeSummary(entries, hidden)).toBe(250)
  })

  it('excludes hidden entries from sum', () => {
    const hidden = new Set(['B'])
    expect(computeSummary(entries, hidden)).toBe(300)
  })

  it('returns 0 when all entries are hidden', () => {
    const hidden = new Set(['A', 'B', 'C'])
    expect(computeSummary(entries, hidden)).toBe(0)
  })

  it('returns 0 for empty entries', () => {
    expect(computeSummary([], new Set())).toBe(0)
  })
})
