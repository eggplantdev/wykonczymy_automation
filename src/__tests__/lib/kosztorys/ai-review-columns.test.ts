import { describe, expect, it } from 'vitest'
import { AI_REVIEW_COLUMN_IDS, aiCommentLines } from '@/lib/kosztorys/ai-review-columns'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'

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

// EX-1057: „Nowe informacje” sits beside Komentarz AI, so the reveal and the picker carry it with the rest.
describe('AI_REVIEW_COLUMN_IDS — Nowe informacje', () => {
  it('follows Komentarz AI and has its label', () => {
    const ids: readonly string[] = AI_REVIEW_COLUMN_IDS
    expect(ids.indexOf('aiNewInformation')).toBe(ids.indexOf('aiComment') + 1)
    expect(COLUMN_LABELS.aiNewInformation).toBe('Nowe informacje')
  })
})
