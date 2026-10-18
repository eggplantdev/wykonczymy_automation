import { describe, it, expect } from 'vitest'
import { formatPLN } from '@/lib/utils/format-currency'

describe('formatPLN', () => {
  it.each([
    [1000, '1000,00\u00a0zł'],
    [12345.67, '12\u00a0345,67\u00a0zł'],
    [0, '0,00\u00a0zł'],
    [-500, '-500,00\u00a0zł'],
    [-0.01, '-0,01\u00a0zł'],
    [-0, '0,00\u00a0zł'],
    [-7e-12, '0,00\u00a0zł'],
    [-0.004, '0,00\u00a0zł'],
  ])('%s → %j', (amount, expected) => {
    expect(formatPLN(amount)).toBe(expected)
  })
})
