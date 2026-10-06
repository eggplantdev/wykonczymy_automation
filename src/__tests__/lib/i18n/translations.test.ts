import { describe, expect, it } from 'vitest'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { ru } from '@/lib/i18n/dictionaries/ru'
import { uk } from '@/lib/i18n/dictionaries/uk'
import { createTranslator, translate } from '@/lib/i18n/translations'
import { itemNoun } from '@/lib/kosztorys/counted-nouns'

const COUNTS = [1, 2, 5, 12, 21, 22, 25]

describe('plurals', () => {
  it('Polish matches today’s `pluralize` for every count', () => {
    const { tp } = createTranslator('pl', 'report')
    for (const count of COUNTS) expect(tp('items', count)).toBe(itemNoun(count))
  })

  it('Ukrainian picks one / few / many by the last digits', () => {
    const { tp } = createTranslator('uk', 'report')
    expect(COUNTS.map((count) => tp('items', count))).toEqual([
      'робота',
      'роботи',
      'робіт',
      'робіт',
      'робота',
      'роботи',
      'робіт',
    ])
  })

  it('Russian picks one / few / many by the last digits', () => {
    const { tp } = createTranslator('ru', 'report')
    expect(COUNTS.map((count) => tp('items', count))).toEqual([
      'работа',
      'работы',
      'работ',
      'работ',
      'работа',
      'работы',
      'работ',
    ])
  })

  it('a counted phrase interpolates its count', () => {
    expect(createTranslator('pl', 'report').tp('draftDropped', 22)).toBe(
      '22 prace ze szkicu zniknęły z rozpiski.',
    )
  })
})

describe('translate', () => {
  it('interpolates named params and leaves an unknown one visible', () => {
    expect(translate('pl', 'media', 'convertFailed', { name: 'skan.heic' })).toBe(
      'Nie udało się przekonwertować „skan.heic” — zapisz jako JPG i spróbuj ponownie.',
    )
    expect(translate('pl', 'media', 'convertFailed')).toBe(
      'Nie udało się przekonwertować „{{name}}” — zapisz jako JPG i spróbuj ponownie.',
    )
  })

  it('an unknown key comes back as the key', () => {
    expect(translate('uk', 'notices', 'gone' as 'closed')).toBe('gone')
  })
})

// The type already refuses a missing key; this catches a plural entry flattened to a string, or a
// string grown into an object, which the structural check would let through as `{}`-compatible.
function shapeOf(value: unknown): unknown {
  if (typeof value === 'string') return 'string'
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, shapeOf(entry)]),
  )
}

describe('dictionary parity', () => {
  it.each([
    ['uk', uk],
    ['ru', ru],
  ])('%s has exactly the Polish keys and shapes', (_, dictionary) => {
    expect(shapeOf(dictionary)).toEqual(shapeOf(pl))
  })
})
