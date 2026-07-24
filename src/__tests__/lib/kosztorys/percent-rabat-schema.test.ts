import { describe, expect, it } from 'vitest'
import { applyPercentRabatSchema } from '@/lib/kosztorys/percent-rabat'

const parse = (percent: unknown) => applyPercentRabatSchema.safeParse({ percent })

describe('applyPercentRabatSchema', () => {
  it('accepts a percent in (0, 100]', () => {
    for (const percent of [0.5, 10, 99.9, 100]) {
      const res = parse(percent)
      expect(res.success).toBe(true)
    }
  })

  // 0 is a mass rabat-clear, not an apply — the owner did not ask for it, so it must not slip through.
  it('rejects 0 (a 0% apply would clear every rabat)', () => {
    expect(parse(0).success).toBe(false)
  })

  it('rejects negatives', () => {
    expect(parse(-5).success).toBe(false)
  })

  it('rejects > 100 (would price a row negative)', () => {
    expect(parse(100.01).success).toBe(false)
    expect(parse(150).success).toBe(false)
  })

  // z.coerce.number() turns a numeric string into a number (the action receives it from an input).
  it('coerces a numeric string', () => {
    const res = parse('15')
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.percent).toBe(15)
  })

  it('rejects non-numeric input', () => {
    expect(parse('abc').success).toBe(false)
  })
})
