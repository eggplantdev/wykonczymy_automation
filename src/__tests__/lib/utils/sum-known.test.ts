import { describe, expect, it } from 'vitest'
import { sumKnown } from '@/lib/utils/sum-known'

describe('sumKnown', () => {
  // The fleet listing's „Razem" footer sums the rows it is rendering. Reducing with `?? 0` printed
  // „0,00 zł" under nine „—" cells the moment the sheet import landed, since not one imported event
  // carries a price.
  it('is unknown when nothing in the set carries a price', () => {
    expect(sumKnown([null, null])).toBeNull()
  })

  it('adds up the known ones and ignores the rest', () => {
    expect(sumKnown([null, 250, null, 100])).toBe(350)
  })

  // Nothing to add up at all is a true zero — an empty listing owes „0,00 zł", not „—".
  it('is zero for an empty set', () => {
    expect(sumKnown([])).toBe(0)
  })

  it('keeps a zero somebody actually typed', () => {
    expect(sumKnown([0])).toBe(0)
  })
})
