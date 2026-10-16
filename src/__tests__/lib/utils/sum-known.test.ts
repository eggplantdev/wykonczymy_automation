import { describe, expect, it } from 'vitest'
import { sumKnown } from '@/lib/utils/sum-known'

describe('sumKnown', () => {
  it('is unknown when nothing in the set carries a price', () => {
    expect(sumKnown([null, null])).toBeNull()
  })

  it('adds up the known ones and ignores the rest', () => {
    expect(sumKnown([null, 250, null, 100])).toBe(350)
  })

  it('is zero for an empty set', () => {
    expect(sumKnown([])).toBe(0)
  })

  it('keeps a zero somebody actually typed', () => {
    expect(sumKnown([0])).toBe(0)
  })
})
