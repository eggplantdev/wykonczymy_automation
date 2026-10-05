import { describe, expect, it } from 'vitest'
import { dammDigit, formatFormRef, parseFormRef } from '@/lib/kosztorys/worker-report/check-digit'

const SAMPLE = 35812

describe('form ref check digit', () => {
  it('round-trips a number through the printed form', () => {
    for (const ref of [1, 9, 10, 572, SAMPLE, 1_000_003]) {
      expect(parseFormRef(formatFormRef(ref))).toBe(ref)
    }
  })

  it('matches the published Damm example', () => {
    expect(dammDigit(572)).toBe(4)
  })

  it('rejects every single-digit substitution', () => {
    const printed = formatFormRef(SAMPLE)
    const digits = printed.replace('-', '')
    for (let index = 0; index < digits.length; index++) {
      for (let replacement = 0; replacement <= 9; replacement++) {
        if (String(replacement) === digits[index]) continue
        const altered = digits.slice(0, index) + replacement + digits.slice(index + 1)
        expect(parseFormRef(`${altered.slice(0, -1)}-${altered.slice(-1)}`)).toBeUndefined()
      }
    }
  })

  it('rejects every adjacent transposition', () => {
    const digits = formatFormRef(SAMPLE).replace('-', '')
    for (let index = 0; index < digits.length - 1; index++) {
      if (digits[index] === digits[index + 1]) continue
      const swapped =
        digits.slice(0, index) + digits[index + 1] + digits[index] + digits.slice(index + 2)
      expect(parseFormRef(`${swapped.slice(0, -1)}-${swapped.slice(-1)}`)).toBeUndefined()
    }
  })

  it('rejects text that is not a printed number', () => {
    for (const text of ['', '35812', '35812-', '-7', '35812-77', 'abc-1', '3 5812-7']) {
      expect(parseFormRef(text)).toBeUndefined()
    }
  })
})
