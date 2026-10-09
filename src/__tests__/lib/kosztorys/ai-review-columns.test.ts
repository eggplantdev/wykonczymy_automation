import { describe, expect, it } from 'vitest'
import { aiCommentLines } from '@/lib/kosztorys/ai-review-columns'

const lines = (aiMissingData: string | null, aiAssumptions: string | null) =>
  aiCommentLines({ aiMissingData, aiAssumptions }).map(
    ({ question, answer }) => `${question}: ${answer}`,
  )

describe('aiCommentLines — Komentarz AI', () => {
  it.each([
    [null, null],
    ['', '  '],
    ['\n \n', null],
  ])('leaves a row with nothing to report blank: %j / %j', (missing, assumed) => {
    expect(lines(missing, assumed)).toEqual([])
  })

  it('answers only the question the agent had something to say about', () => {
    expect(lines(null, 'wysokość 2,68 m')).toEqual(['Co / ile założono: wysokość 2,68 m'])
  })

  it('reads one item per line as one comma-separated answer', () => {
    expect(lines('a\n\n b \n', null)).toEqual(['Czego nie było wiadomo: a, b'])
  })
})
