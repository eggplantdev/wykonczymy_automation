import { describe, expect, it } from 'vitest'
import { roundToCents } from '@/lib/utils/round-to-cents'

describe('roundToCents', () => {
  // One half-grosz amount reached two ways: exact from Postgres, and with a float residue from a JS
  // fold (5000 − 2.5 × 1125.89). Both surfaces must print the same grosz.
  it('rounds a half grosz the same way whatever float residue it carries', () => {
    expect(roundToCents(2185.275)).toBe(2185.28)
    expect(roundToCents(5000 - 2.5 * 1125.89)).toBe(2185.28)
  })

  it('still rounds an amount just below the half down', () => {
    expect(roundToCents(2185.2749)).toBe(2185.27)
  })

  it('never returns a negative zero', () => {
    expect(Object.is(roundToCents(-1e-14), 0)).toBe(true)
  })
})
