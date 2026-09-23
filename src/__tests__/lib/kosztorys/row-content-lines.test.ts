import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  clippedRowClass,
  rowContentLines,
  wrapColumnClass,
  WRAPPING_COLUMN_IDS,
} from '@/lib/kosztorys/row-content-lines'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Ten pixels a character, so a width of 101 fits exactly ten characters once the 1px edge tolerance
// comes off — the expectations below are countable by hand.
const tenPxPerChar = (text: string) => text.length * 10

function row(fields: Partial<KosztorysV2RowT>): KosztorysV2RowT {
  return { id: 1, description: null, note: null, ...fields } as KosztorysV2RowT
}

describe('rowContentLines', () => {
  it('gives an empty row one line', () => {
    expect(rowContentLines(row({}), { description: 101 }, tenPxPerChar)).toBe(1)
  })

  it('counts the lines the description wraps onto', () => {
    const value = 'aaaa bbbb cccc dddd'
    expect(rowContentLines(row({ description: value }), { description: 101 }, tenPxPerChar)).toBe(2)
  })

  it('takes the tallest column, not the first', () => {
    const fields = { description: 'aaaa', note: 'aaaa bbbb cccc dddd' }
    expect(rowContentLines(row(fields), { description: 101, note: 101 }, tenPxPerChar)).toBe(2)
  })

  it('ignores a column the client cannot see', () => {
    const fields = { description: 'aaaa', note: 'aaaa bbbb cccc dddd' }
    expect(rowContentLines(row(fields), { description: 101 }, tenPxPerChar)).toBe(1)
  })

  it('falls back to one line before the widths have been measured', () => {
    expect(rowContentLines(row({ description: 'aaaa bbbb cccc' }), {}, tenPxPerChar)).toBe(1)
  })
})

// „Sekcja" is shown far more often than it is long, so the interesting case is the one where a long
// name lifts a row whose own description is short.
describe('rowContentLines — kolumna Sekcja', () => {
  it('counts the lines the section name wraps onto', () => {
    const fields = { sectionName: 'aaaa bbbb cccc dddd', description: 'aaaa' }
    expect(rowContentLines(row(fields), { sectionName: 101, description: 101 }, tenPxPerChar)).toBe(
      2,
    )
  })
})

// The clip cue is the one part of the wrapping contract that lives in hand-written CSS: `globals.css`
// spells out a `.kosztorys-clipped-<id> .kosztorys-wrap-<id>::after` pair per column, so a fourth
// wrapping column added to the list above gets measured, clipped — and shows no „…" at all. Nothing
// else can catch that: both class names still build fine, and the missing selector is invisible until
// someone notices a truncated opis that never says it was truncated.
describe('the clip cue’s CSS keeps up with WRAPPING_COLUMN_IDS', () => {
  const css = readFileSync('src/styles/globals.css', 'utf8')

  it.each(WRAPPING_COLUMN_IDS)('draws the „…" for %s', (id) => {
    expect(css).toContain(`.${clippedRowClass(id)} .dsg-cell.${wrapColumnClass(id)}::after`)
  })
})
