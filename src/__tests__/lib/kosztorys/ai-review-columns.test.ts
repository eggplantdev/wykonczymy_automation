import { describe, expect, it } from 'vitest'
import {
  AI_REVIEW_COLUMN_IDS,
  aiCommentLines,
  aiNewInformationLines,
} from '@/lib/kosztorys/ai-review-columns'
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

// EX-1057, #190 round 2: the cell printed the stored text raw, while Komentarz AI beside it reads as
// label + bold answer — the two columns have to look the same.
describe('aiNewInformationLines — Nowe informacje', () => {
  const round = (n: number, line: string) =>
    `Runda ${n} — AI przedmiar: 0 → 6,89 m²\nPowód: projekt wykonawczy\n${line}`

  it.each([null, '', ' \n\n '])('leaves an empty cell blank: %j', (text) => {
    expect(aiNewInformationLines(text)).toEqual([])
  })

  it('splits every line into its label and the answer after it', () => {
    expect(aiNewInformationLines(round(2, 'Nie wiadomo: grubość: 10 czy 12 cm'))).toEqual([
      { label: 'Runda 2 — AI przedmiar', answer: '0 → 6,89 m²' },
      { label: 'Powód', answer: 'projekt wykonawczy' },
      { label: 'Nie wiadomo', answer: 'grubość: 10 czy 12 cm' },
    ])
  })

  it('reads every round, in the order they were appended', () => {
    const text = `${round(2, 'Założono: a')}\n\n${round(3, 'Wyjaśnione: b')}`
    expect(
      aiNewInformationLines(text)
        .map(({ label }) => label)
        .filter((label) => label?.startsWith('Runda')),
    ).toEqual(['Runda 2 — AI przedmiar', 'Runda 3 — AI przedmiar'])
  })

  it('shows a line with no label as it stands', () => {
    expect(aiNewInformationLines('dopisek bez etykiety')).toEqual([
      { label: null, answer: 'dopisek bez etykiety' },
    ])
  })
})
