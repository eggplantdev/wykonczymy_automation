import { describe, it, expect } from 'vitest'
import {
  aiFillWrites,
  needsTranslation,
  planAiFill,
  sectionLanguagesToFill,
  sectionTemplatesFromAi,
  type FillRowT,
} from '@/lib/i18n/ai-translation-fill'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'

const row = (overrides: Partial<FillRowT> & { id: number }): FillRowT => ({
  description: 'Malowanie ścian',
  unit: 'm2',
  translations: {},
  ...overrides,
})

describe('needsTranslation', () => {
  it('is true for a missing or stale translation and false for a current one', () => {
    const translations = { uk: { text: 'Фарбування', source: 'Malowanie' } }
    expect(needsTranslation(translations, 'ru', 'Malowanie')).toBe(true)
    expect(needsTranslation(translations, 'uk', 'Malowanie ścian')).toBe(true)
    expect(needsTranslation(translations, 'uk', 'Malowanie')).toBe(false)
  })

  it('is false for an empty opis — there is nothing to translate', () => {
    expect(needsTranslation({}, 'uk', '  ')).toBe(false)
    expect(needsTranslation({}, 'uk', null)).toBe(false)
  })
})

describe('planAiFill', () => {
  it('sends each distinct trimmed opis once, with only the languages each row lacks', () => {
    const plan = planAiFill(
      [
        row({ id: 1 }),
        row({ id: 2, description: 'Malowanie ścian ' }),
        row({ id: 3, translations: { uk: { text: 'Фарбування стін', source: 'Malowanie ścian' } } }),
      ],
      new Map(),
    )

    expect(plan.fromCatalogue).toEqual([])
    expect(plan.toTranslate).toEqual([
      {
        text: 'Malowanie ścian',
        rows: [
          { id: 1, description: 'Malowanie ścian', languages: ['uk', 'ru'] },
          { id: 2, description: 'Malowanie ścian ', languages: ['uk', 'ru'] },
          { id: 3, description: 'Malowanie ścian', languages: ['ru'] },
        ],
      },
    ])
  })

  it('reuses a current katalog translation and sends a stale one to the AI', () => {
    const catalogue = new Map([
      [
        catalogueKey('Malowanie ścian', 'm2'),
        {
          uk: { text: 'Фарбування стін', source: 'malowanie scian' },
          ru: { text: 'Покраска', source: 'Malowanie' },
        },
      ],
    ])

    const plan = planAiFill([row({ id: 1 })], catalogue)

    expect(plan.fromCatalogue).toEqual([
      {
        id: 1,
        description: 'Malowanie ścian',
        translations: { uk: { text: 'Фарбування стін', source: 'Malowanie ścian' } },
      },
    ])
    expect(plan.toTranslate[0]?.rows).toEqual([
      { id: 1, description: 'Malowanie ścian', languages: ['ru'] },
    ])
  })

  it('skips a row whose translations are all current', () => {
    const plan = planAiFill(
      [
        row({
          id: 1,
          translations: {
            uk: { text: 'a', source: 'Malowanie ścian' },
            ru: { text: 'b', source: 'Malowanie ścian' },
          },
        }),
      ],
      new Map(),
    )
    expect(plan).toEqual({ fromCatalogue: [], toTranslate: [] })
  })
})

describe('aiFillWrites', () => {
  it('stamps each row with its own opis and counts the languages the AI left blank', () => {
    const { writes, failed } = aiFillWrites(
      [
        {
          text: 'Malowanie ścian',
          rows: [
            { id: 1, description: 'Malowanie ścian', languages: ['uk', 'ru'] },
            { id: 2, description: 'Malowanie ścian ', languages: ['uk'] },
          ],
        },
        { text: 'Gruntowanie', rows: [{ id: 3, description: 'Gruntowanie', languages: ['uk'] }] },
      ],
      new Map([['Malowanie ścian', { uk: 'Фарбування стін' }]]),
    )

    expect(writes).toEqual([
      { id: 1, description: 'Malowanie ścian', translations: { uk: { text: 'Фарбування стін', source: 'Malowanie ścian' } } },
      { id: 2, description: 'Malowanie ścian ', translations: { uk: { text: 'Фарбування стін', source: 'Malowanie ścian ' } } },
    ])
    expect(failed).toBe(2)
  })
})

describe('section templates', () => {
  it('fills only languages with no template', () => {
    expect(sectionLanguagesToFill({ uk: 'Ванна #', ru: ' ' })).toEqual(['ru'])
  })

  it('keeps an AI answer with the name’s numbers and drops one that renumbered the room', () => {
    expect(
      sectionTemplatesFromAi('Łazienka 2', { uk: 'Ванна кімната 2', ru: 'Ванная 1' }),
    ).toEqual({ uk: 'Ванна кімната #' })
  })
})
