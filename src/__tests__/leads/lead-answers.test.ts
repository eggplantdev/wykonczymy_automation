import { describe, it, expect } from 'vitest'
import { buildLeadAnswers } from '@/lib/leads/lead-answers'

describe('buildLeadAnswers', () => {
  it('maps each raw field to its form-question label, in submission order', () => {
    const answers = buildLeadAnswers(
      [
        { name: 'dzielnica', values: ['Mokotów'] },
        { name: 'pomieszczenie', values: ['Kuchnia'] },
      ],
      [
        { key: 'dzielnica', label: 'Z jakiej dzielnicy?' },
        { key: 'pomieszczenie', label: 'Jakie pomieszczenie?' },
      ],
    )
    expect(answers).toEqual([
      { label: 'Z jakiej dzielnicy?', value: 'Mokotów' },
      { label: 'Jakie pomieszczenie?', value: 'Kuchnia' },
    ])
  })

  it('falls back to a humanized key when the label is missing', () => {
    const answers = buildLeadAnswers([{ name: 'z_jakiej_dzielnicy', values: ['Wola'] }], undefined)
    expect(answers).toEqual([{ label: 'z jakiej dzielnicy', value: 'Wola' }])
  })

  it('joins multi-value answers and drops empty ones', () => {
    const answers = buildLeadAnswers(
      [
        { name: 'a', values: ['x', 'y'] },
        { name: 'b', values: [] },
        { name: 'c', values: [''] },
      ],
      [{ key: 'a', label: 'A' }],
    )
    expect(answers).toEqual([{ label: 'A', value: 'x, y' }])
  })

  it('returns [] when there is no raw data', () => {
    expect(buildLeadAnswers(undefined, [{ key: 'a', label: 'A' }])).toEqual([])
  })
})
