import { describe, expect, it } from 'vitest'
import { parseColumnWidth } from '@/lib/kosztorys/parse-column-width'

describe('parseColumnWidth', () => {
  it.each([
    ['120', 120],
    [' 120 ', 120],
    ['12,6', 40],
    ['120,4', 120],
    ['120,6', 121],
    ['120.6', 121],
    ['10', 40],
  ])('%j → %d', (text, expected) => {
    expect(parseColumnWidth(text, 40)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '0', '-5', 'Infinity'])('%j → undefined', (text) => {
    expect(parseColumnWidth(text, 40)).toBeUndefined()
  })
})
