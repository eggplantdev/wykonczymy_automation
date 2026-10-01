import { describe, expect, it } from 'vitest'
import {
  escapeCell,
  exportUntranslated,
  parseTranslationFile,
  planTranslationFill,
  type TranslationFillRowT,
} from '@/lib/i18n/translation-fill'

const row = (
  id: number,
  description: string,
  descriptionTranslations: TranslationFillRowT['descriptionTranslations'] = {},
  table: TranslationFillRowT['table'] = 'kosztorys_items',
): TranslationFillRowT => ({ table, id, description, descriptionTranslations })

const FILE = new Map([
  ['Malowanie ścian', 'Фарбування стін'],
  ['Gruntowanie', 'Ґрунтування'],
])

describe('planTranslationFill', () => {
  it('fills an empty translation and stamps the row’s own opis as its source', () => {
    const { fills } = planTranslationFill([row(1, ' Malowanie ścian ')], FILE, 'uk')

    expect(fills).toEqual([
      {
        row: expect.objectContaining({ id: 1 }),
        descriptionTranslations: { uk: { text: 'Фарбування стін', source: ' Malowanie ścian ' } },
      },
    ])
  })

  it('never overwrites a translation somebody already made', () => {
    const typed = { uk: { text: 'Покраска', source: 'Malowanie ścian' } }
    const plan = planTranslationFill([row(1, 'Malowanie ścian', typed)], FILE, 'uk')

    expect(plan.fills).toEqual([])
    expect(plan.alreadyTranslated).toBe(1)
  })

  it('keeps the other language’s translation beside the new one', () => {
    const russian = { ru: { text: 'Грунтовка', source: 'Gruntowanie' } }
    const { fills } = planTranslationFill([row(1, 'Gruntowanie', russian)], FILE, 'uk')

    expect(fills[0]?.descriptionTranslations).toEqual({
      ru: { text: 'Грунтовка', source: 'Gruntowanie' },
      uk: { text: 'Ґрунтування', source: 'Gruntowanie' },
    })
  })

  it('reports an opis the file does not carry once, however many rows hold it', () => {
    const plan = planTranslationFill([row(1, 'Fugowanie'), row(2, 'Fugowanie')], FILE, 'uk')

    expect(plan.fills).toEqual([])
    expect(plan.missing).toEqual(['Fugowanie'])
  })
})

describe('the translation file', () => {
  it('round-trips an opis with a line break and a tab', () => {
    const polish = 'Montaż\nlistew\tprzypodłogowych'
    const file = parseTranslationFile(`${escapeCell(polish)}\tМонтаж плінтусів\n`)

    expect(file.get(polish)).toBe('Монтаж плінтусів')
  })

  it('skips comments and lines nobody translated yet', () => {
    const file = parseTranslationFile('# eksport\nMalowanie ścian\t\nGruntowanie\tҐрунтування\n')

    expect([...file.keys()]).toEqual(['Gruntowanie'])
  })
})

describe('exportUntranslated', () => {
  it('lists each untranslated opis once with where it appears', () => {
    const entries = exportUntranslated(
      [
        row(1, 'Malowanie ścian', {}, 'work_catalogue_items'),
        row(2, 'Malowanie ścian'),
        row(3, 'Malowanie ścian'),
        row(4, 'Gruntowanie', { uk: { text: 'Ґрунтування', source: 'Gruntowanie' } }),
      ],
      'uk',
    )

    expect(entries).toEqual([{ description: 'Malowanie ścian', catalogue: 1, items: 2 }])
  })
})
