import { describe, it, expect } from 'vitest'
import { getMonthDateRange } from '@/lib/utils/date'

describe('getMonthDateRange', () => {
  it('returns correct range for January', () => {
    expect(getMonthDateRange(1, 2024)).toEqual({ from: '2024-01-01', to: '2024-01-31' })
  })

  it('returns correct range for February (non-leap year)', () => {
    expect(getMonthDateRange(2, 2023)).toEqual({ from: '2023-02-01', to: '2023-02-28' })
  })

  it('returns correct range for February (leap year)', () => {
    expect(getMonthDateRange(2, 2024)).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })

  it('returns correct range for December', () => {
    expect(getMonthDateRange(12, 2024)).toEqual({ from: '2024-12-01', to: '2024-12-31' })
  })

  it('returns correct range for April (30 days)', () => {
    expect(getMonthDateRange(4, 2024)).toEqual({ from: '2024-04-01', to: '2024-04-30' })
  })
})
