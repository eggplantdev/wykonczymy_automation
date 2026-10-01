import { describe, expect, it } from 'vitest'
import { withRowTranslation } from '@/lib/kosztorys/row-translation'
import { row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'

describe('withRowTranslation — the translation cell’s write path', () => {
  it('stamps `source` from the row’s current opis', () => {
    const next = withRowTranslation(
      row({ description: 'Gruntowanie ścian', descriptionTranslations: {} }),
      'uk',
      'Ґрунтування стін',
    )
    expect(next.descriptionTranslations).toEqual({
      uk: { text: 'Ґрунтування стін', source: 'Gruntowanie ścian' },
    })
  })

  it('re-stamps a stale translation once it is retyped against the new opis', () => {
    const next = withRowTranslation(
      row({
        description: 'Gruntowanie ścian i sufitów',
        descriptionTranslations: { uk: { text: 'Ґрунтування стін', source: 'Gruntowanie ścian' } },
      }),
      'uk',
      'Ґрунтування стін і стель',
    )
    expect(next.descriptionTranslations.uk?.source).toBe('Gruntowanie ścian i sufitów')
  })

  it('keeps the other languages — the patch carries the whole map', () => {
    const russian = { text: 'Грунтовка стен', source: 'Gruntowanie ścian' }
    const next = withRowTranslation(
      row({ description: 'Gruntowanie ścian', descriptionTranslations: { ru: russian } }),
      'uk',
      'Ґрунтування стін',
    )
    expect(next.descriptionTranslations.ru).toEqual(russian)
  })

  it('an emptied cell drops the language', () => {
    const next = withRowTranslation(
      row({
        description: 'Gruntowanie ścian',
        descriptionTranslations: { uk: { text: 'Ґрунтування стін', source: 'Gruntowanie ścian' } },
      }),
      'uk',
      null,
    )
    expect(next.descriptionTranslations).toEqual({})
  })
})
