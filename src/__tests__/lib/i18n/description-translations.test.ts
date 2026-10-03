import { describe, expect, it } from 'vitest'
import {
  isTranslationStale,
  mergeTranslations,
  restampTranslations,
  toDescriptionTranslations,
  translationsFromTexts,
  withTranslation,
} from '@/lib/i18n/description-translations'

describe('toDescriptionTranslations', () => {
  it('keeps known languages and drops unknown, malformed and empty entries', () => {
    expect(
      toDescriptionTranslations({
        uk: { text: 'Фарбування', source: 'Malowanie' },
        ru: { text: '   ', source: 'Malowanie' },
        de: { text: 'Malen', source: 'Malowanie' },
        pl: { text: 'Malowanie', source: 'Malowanie' },
      }),
    ).toEqual({ uk: { text: 'Фарбування', source: 'Malowanie' } })
    expect(toDescriptionTranslations({ uk: 'Фарбування' })).toEqual({})
  })

  it('reads a missing or non-object value as no translations', () => {
    expect(toDescriptionTranslations(null)).toEqual({})
    expect(toDescriptionTranslations(undefined)).toEqual({})
    expect(toDescriptionTranslations([])).toEqual({})
    expect(toDescriptionTranslations('{}')).toEqual({})
  })
})

describe('isTranslationStale', () => {
  const translations = { uk: { text: 'Фарбування', source: 'Malowanie' } }

  it('is stale once the opis moves away from the text it was made from', () => {
    expect(isTranslationStale(translations, 'uk', 'Malowanie ścian')).toBe(true)
  })

  it('clears itself when the opis is reverted', () => {
    expect(isTranslationStale(translations, 'uk', 'Malowanie')).toBe(false)
  })

  it('is never stale without a translation', () => {
    expect(isTranslationStale(translations, 'ru', 'Malowanie ścian')).toBe(false)
  })
})

describe('withTranslation', () => {
  it('stamps the source from the opis it is typed against and leaves other languages alone', () => {
    const before = { ru: { text: 'Покраска', source: 'Malowanie' } }
    expect(withTranslation(before, 'uk', 'Фарбування стін', 'Malowanie ścian')).toEqual({
      ru: { text: 'Покраска', source: 'Malowanie' },
      uk: { text: 'Фарбування стін', source: 'Malowanie ścian' },
    })
  })

  it('removes the language when the text is emptied', () => {
    const before = { uk: { text: 'Фарбування', source: 'Malowanie' } }
    expect(withTranslation(before, 'uk', '  ', 'Malowanie')).toEqual({})
  })
})

describe('mergeTranslations', () => {
  it("takes the incoming language where it has one and keeps the existing one where it doesn't", () => {
    expect(
      mergeTranslations(
        {
          uk: { text: 'старий', source: 'Malowanie' },
          ru: { text: 'старый', source: 'Malowanie' },
        },
        { uk: { text: 'новий', source: 'Malowanie ścian' } },
        'Malowanie ścian',
      ),
    ).toEqual({
      uk: { text: 'новий', source: 'Malowanie ścian' },
      ru: { text: 'старый', source: 'Malowanie' },
    })
  })

  it('keeps a current translation over an incoming one made from another opis', () => {
    const current = { text: 'Фарбування стін', source: 'Malowanie ścian' }
    expect(
      mergeTranslations(
        { uk: current },
        { uk: { text: 'Фарбування', source: 'Malowanie' } },
        'Malowanie ścian',
      ),
    ).toEqual({ uk: current })
  })
})

describe('restampTranslations', () => {
  it('moves a current translation onto the corrected opis and leaves a stale one stale', () => {
    expect(
      restampTranslations(
        {
          uk: { text: 'Фарбування', source: 'Malowanei' },
          ru: { text: 'Покраска', source: 'Malowanie starego tynku' },
        },
        'Malowanei',
        'Malowanie',
      ),
    ).toEqual({
      uk: { text: 'Фарбування', source: 'Malowanie' },
      ru: { text: 'Покраска', source: 'Malowanie starego tynku' },
    })
  })
})

describe('translationsFromTexts — the katalog form back onto its map', () => {
  const stale = { text: 'Фарбування', source: 'Malowanie' }

  it('leaves an untouched language alone, so a stale translation stays stale', () => {
    expect(
      translationsFromTexts({ uk: stale }, { uk: 'Фарбування', ru: '' }, 'Malowanie ścian'),
    ).toEqual({ uk: stale })
  })

  it('stamps a changed text against the form’s opis and drops an emptied one', () => {
    expect(
      translationsFromTexts({ uk: stale }, { uk: '', ru: 'Покраска стен' }, 'Malowanie ścian'),
    ).toEqual({ ru: { text: 'Покраска стен', source: 'Malowanie ścian' } })
  })
})
