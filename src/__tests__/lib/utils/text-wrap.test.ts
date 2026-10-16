import { describe, expect, it } from 'vitest'
import { countWrappedLines } from '@/lib/utils/text-wrap'

const tenPxPerChar = (text: string) => text.length * 10

// The tolerance the wrapper shaves off the column before comparing, mirrored here
const TOLERANCE = 1

describe('countWrappedLines', () => {
  it('keeps a short text on one line', () => {
    expect(countWrappedLines('abc', 100 + TOLERANCE, tenPxPerChar)).toBe(1)
  })

  it('wraps whole words onto the next line', () => {
    expect(countWrappedLines('aaa bbb ccc', 70 + TOLERANCE, tenPxPerChar)).toBe(2)
  })

  it('breaks a single word wider than the column', () => {
    expect(countWrappedLines('aaaaaaaaa', 30 + TOLERANCE, tenPxPerChar)).toBe(3)
  })

  it('lets the next word share the tail line left by a broken word', () => {
    // 'aaaaa' fills 50px: two full 20px lines plus a 10px tail. 'b' joins that tail only when the
    // separating space fits too — at 20px it does not ('a b' is 30px), so 'b' takes a fourth line.
    expect(countWrappedLines('aaaaa b', 20 + TOLERANCE, tenPxPerChar)).toBe(4)
    expect(countWrappedLines('aaaaa b', 40 + TOLERANCE, tenPxPerChar)).toBe(2)
  })

  it('breaks on hard newlines even when the text would fit', () => {
    expect(countWrappedLines('a\nb\nc', 1000, tenPxPerChar)).toBe(3)
  })

  it('counts a blank line between paragraphs', () => {
    expect(countWrappedLines('a\n\nb', 1000, tenPxPerChar)).toBe(3)
  })

  it('returns one line for empty text', () => {
    expect(countWrappedLines('', 100, tenPxPerChar)).toBe(1)
  })

  it('returns one line rather than dividing by a zero-width column', () => {
    expect(countWrappedLines('anything at all', 0, tenPxPerChar)).toBe(1)
    expect(countWrappedLines('anything at all', -50, tenPxPerChar)).toBe(1)
  })

  it('rounds a text sitting exactly on the column edge to the taller row', () => {
    // canvas and layout disagree here, so the wrapper must not claim it fits.
    expect(countWrappedLines('aaaaaaaaaa', 100, tenPxPerChar)).toBe(2)
  })

  it('collapses runs of whitespace, which is why the cell is whitespace-pre-line', () => {
    // `pre-wrap` would PRESERVE the run and lay out ten characters where this counts seven, so a
    // pasted double space would under-count the lines and the row would clip.
    expect(countWrappedLines('aaa    bbb', 70 + TOLERANCE, tenPxPerChar)).toBe(1)
  })
})
