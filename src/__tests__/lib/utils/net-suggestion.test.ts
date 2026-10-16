import { describe, it, expect } from 'vitest'
import { netSuggestion } from '@/lib/utils/net-suggestion'

describe('netSuggestion', () => {
  const RATE = 0.23

  it('fills an empty netto from the brutto beside it', () => {
    expect(netSuggestion('', '1230', null, RATE)).toBe('1000.00')
  })

  it('re-suggests over its own last suggestion — a new stawka moves it', () => {
    expect(netSuggestion('1000.00', '1230', '1000.00', 0.08)).toBe('1138.89')
  })

  it('leaves a kwota the owner typed over the suggestion', () => {
    expect(netSuggestion('950', '1230', '1000.00', RATE)).toBeNull()
  })

  it('leaves a restored draft alone — no suggestion was made in this mount', () => {
    expect(netSuggestion('950', '1230', null, RATE)).toBeNull()
  })

  it('resumes after the field is cleared — a reset is not the owner typing', () => {
    expect(netSuggestion('', '1230', '1000.00', RATE)).toBe('1000.00')
  })
})
