import { describe, expect, it } from 'vitest'
import { applyPercentDiscountSchema } from '@/lib/kosztorys/percent-discount'

const parse = (percent: unknown) => applyPercentDiscountSchema.safeParse({ percent })

describe('applyPercentDiscountSchema', () => {
  it('accepts a percent in [0, 100]', () => {
    for (const percent of [0.5, 10, 99.9, 100]) {
      const res = parse(percent)
      expect(res.success).toBe(true)
    }
  })

  it('accepts 0 (turning the rabat off)', () => {
    expect(parse(0).success).toBe(true)
  })

  it('rejects negatives', () => {
    expect(parse(-5).success).toBe(false)
  })

  it('rejects > 100 (would price a row negative)', () => {
    expect(parse(100.01).success).toBe(false)
    expect(parse(150).success).toBe(false)
  })

  it('coerces a numeric string', () => {
    const res = parse('15')
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.percent).toBe(15)
  })

  it('rejects non-numeric input', () => {
    expect(parse('abc').success).toBe(false)
  })
})
