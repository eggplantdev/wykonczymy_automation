import { describe, expect, it } from 'vitest'

import {
  SECTION_COLORS,
  SECTION_COLOR_SEQUENCE,
  sectionColorForIndex,
} from '@/lib/kosztorys/section-colors'

describe('SECTION_COLOR_SEQUENCE', () => {
  it('is a permutation of the palette — every colour exactly once', () => {
    expect(SECTION_COLOR_SEQUENCE.length).toBe(SECTION_COLORS.length)
    expect(new Set(SECTION_COLOR_SEQUENCE).size).toBe(SECTION_COLORS.length)
    expect([...SECTION_COLOR_SEQUENCE].sort()).toEqual(SECTION_COLORS.map((c) => c.key).sort())
  })

  it('never gives two adjacent sections the same hue', () => {
    // `blue-soft` / `blue` / `blue-deep` are three tints of one hue — the leading segment names it.
    const hue = (key: string) => key.split('-')[0]
    for (let i = 1; i < SECTION_COLOR_SEQUENCE.length; i++) {
      expect(hue(SECTION_COLOR_SEQUENCE[i])).not.toBe(hue(SECTION_COLOR_SEQUENCE[i - 1]))
    }
  })

  it('wraps rather than running out', () => {
    expect(sectionColorForIndex(SECTION_COLORS.length)).toBe(SECTION_COLOR_SEQUENCE[0])
  })
})
