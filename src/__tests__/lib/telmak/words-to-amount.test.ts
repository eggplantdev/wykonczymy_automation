import { describe, it, expect } from 'vitest'
import { wordsToAmount } from '@/lib/telmak/words-to-amount'

describe('wordsToAmount', () => {
  it.each([
    ['tysiąc PLN', 1000],
    ['dwa tysiące trzysta PLN', 2300],
    ['pięć tysięcy PLN 5/100', 5000.05],
    ['dwanaście tysięcy sto jeden PLN 99/100', 12101.99],
    ['zero PLN 40/100', 0.4],
  ])('%s → %d', (text, expected) => {
    expect(wordsToAmount(text)).toBe(expected)
  })

  it('returns null for an unknown word or a missing currency', () => {
    expect(wordsToAmount('sto euro')).toBeNull()
    expect(wordsToAmount('sto złotych PLN')).toBeNull()
  })
})
