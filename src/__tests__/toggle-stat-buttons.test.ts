import { describe, it, expect } from 'vitest'
import { computeSummary, buildToggleResult } from '@/components/ui/toggle-stat-buttons'

describe('computeSummary', () => {
  const entries = [
    { label: 'A', value: '100 zł', amount: 100, borderClassName: 'blue' },
    { label: 'B', value: '-50 zł', amount: -50, borderClassName: 'red' },
    { label: 'C', value: '200 zł', amount: 200, borderClassName: 'green' },
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

describe('computeSummary with paired entries', () => {
  const entries = [
    { label: 'Income', value: '1000 zł', amount: 1000, borderClassName: 'green' },
    { label: 'Labor', value: '-200 zł', amount: -200, borderClassName: 'orange' },
    { label: 'Payouts', value: '-150 zł', amount: -150, borderClassName: 'pink' },
  ] as const

  it('excludes defaultHidden entry when it is in the hidden set', () => {
    const hidden = new Set(['Payouts'])
    expect(computeSummary(entries, hidden)).toBe(800) // 1000 - 200
  })

  it('includes defaultHidden entry and excludes its pair when swapped', () => {
    const hidden = new Set(['Labor'])
    expect(computeSummary(entries, hidden)).toBe(850) // 1000 - 150
  })
})

describe('buildToggleResult', () => {
  it('clicking hidden paired card: shows it, hides its pair', () => {
    const hidden = new Set(['Payouts'])
    const result = buildToggleResult('Payouts', hidden, 'Labor')
    expect(result.has('Payouts')).toBe(false)
    expect(result.has('Labor')).toBe(true)
  })

  it('clicking visible paired card: no-op', () => {
    const hidden = new Set(['Payouts'])
    const result = buildToggleResult('Labor', hidden, 'Payouts')
    expect(result.has('Labor')).toBe(false)
    expect(result.has('Payouts')).toBe(true)
  })

  it('non-paired card: normal toggle on', () => {
    const hidden = new Set<string>()
    const result = buildToggleResult('Income', hidden, undefined)
    expect(result.has('Income')).toBe(true)
  })

  it('non-paired card: normal toggle off', () => {
    const hidden = new Set(['Income'])
    const result = buildToggleResult('Income', hidden, undefined)
    expect(result.has('Income')).toBe(false)
  })
})
