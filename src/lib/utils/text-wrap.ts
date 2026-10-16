export type MeasureTextWidthT = (text: string) => number

// Canvas width and layout width disagree by a fraction of a pixel, so a line that ends exactly at
// the column edge can round either way.
const EDGE_TOLERANCE_PX = 1

// Words break onto the next line whole; a single word wider than the column breaks mid-word,
// matching `overflow-wrap: break-word` in the cell's CSS.
export function countWrappedLines(
  text: string,
  availableWidth: number,
  measure: MeasureTextWidthT,
): number {
  const limit = availableWidth - EDGE_TOLERANCE_PX
  if (!text || limit <= 0) return 1

  let lines = 0
  for (const paragraph of text.split('\n')) {
    lines += countParagraphLines(paragraph, limit, measure)
  }
  return Math.max(1, lines)
}

function countParagraphLines(paragraph: string, limit: number, measure: MeasureTextWidthT): number {
  const words = paragraph.split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1

  let lines = 1
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measure(candidate) <= limit) {
      current = candidate
      continue
    }
    if (current) {
      lines += 1
      current = ''
    }
    const [extraLines, remainder] = breakLongWord(word, limit, measure)
    lines += extraLines
    current = remainder
  }

  return lines
}

function breakLongWord(word: string, limit: number, measure: MeasureTextWidthT): [number, string] {
  if (measure(word) <= limit) return [0, word]

  let extraLines = 0
  let current = ''

  for (const char of word) {
    const candidate = current + char
    if (measure(candidate) <= limit || !current) {
      current = candidate
      continue
    }
    extraLines += 1
    current = char
  }

  return [extraLines, current]
}
