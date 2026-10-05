import { describe, expect, it } from 'vitest'
import { translateTree } from '@/lib/kosztorys/worker-view/translate-tree'
import type { DescriptionTranslationsT } from '@/lib/i18n/description-translations'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

function treeOf(
  items: {
    id: number
    description: string
    descriptionTranslations?: DescriptionTranslationsT
    unit?: string | null
  }[],
  name = 'Łazienka',
): KosztorysTreeT {
  const withUnits = items.map((item) => ({ unit: null, ...item }))
  return { sections: [{ id: 1, name, items: withUnits }] } as unknown as KosztorysTreeT
}

const units = (tree: KosztorysTreeT) =>
  tree.sections.flatMap((section) => section.items.map((item) => item.unit))

const descriptions = (tree: KosztorysTreeT) =>
  tree.sections.flatMap((section) => section.items.map((item) => item.description))

describe('translateTree', () => {
  it('shows each opis in the worker’s language', () => {
    const tree = treeOf([
      {
        id: 1,
        description: 'Malowanie ścian',
        descriptionTranslations: {
          uk: { text: 'Фарбування стін', source: 'Malowanie ścian' },
          ru: { text: 'Покраска стен', source: 'Malowanie ścian' },
        },
      },
    ])

    expect(descriptions(translateTree(tree, 'uk', {}))).toEqual(['Фарбування стін'])
    expect(descriptions(translateTree(tree, 'ru', {}))).toEqual(['Покраска стен'])
  })

  it('keeps the Polish opis where nobody translated it yet', () => {
    const tree = treeOf([
      { id: 1, description: 'Malowanie ścian' },
      {
        id: 2,
        description: 'Gruntowanie',
        descriptionTranslations: { ru: { text: 'Грунтовка', source: 'Gruntowanie' } },
      },
    ])

    expect(descriptions(translateTree(tree, 'uk', {}))).toEqual(['Malowanie ścian', 'Gruntowanie'])
  })

  it('still shows a translation made from an older opis', () => {
    const tree = treeOf([
      {
        id: 1,
        description: 'Malowanie ścian dwukrotnie',
        descriptionTranslations: { uk: { text: 'Фарбування стін', source: 'Malowanie ścian' } },
      },
    ])

    expect(descriptions(translateTree(tree, 'uk', {}))).toEqual(['Фарбування стін'])
  })

  it('keeps every pozycja id, so the draft and the send key by the same rows', () => {
    const tree = treeOf([
      {
        id: 7,
        description: 'Malowanie ścian',
        descriptionTranslations: { uk: { text: 'Фарбування стін', source: 'Malowanie ścian' } },
      },
    ])

    expect(translateTree(tree, 'uk', {}).sections[0].items[0].id).toBe(7)
  })

  it('shows each j.m. in the worker’s language and keeps one off the list as typed', () => {
    const tree = treeOf([
      { id: 1, description: 'Malowanie ścian', unit: 'm2' },
      { id: 2, description: 'Listwy', unit: 'mb' },
      { id: 3, description: 'Wywóz gruzu', unit: 'big bag' },
      { id: 4, description: 'Uwagi', unit: null },
    ])

    expect(units(translateTree(tree, 'uk', {}))).toEqual(['м²', 'пог. м', 'big bag', null])
  })

  it('hands a Polish worker the tree untouched', () => {
    const tree = treeOf([{ id: 1, description: 'Malowanie ścian' }])

    expect(translateTree(tree, 'pl', {})).toBe(tree)
  })

  describe('section names', () => {
    const sectionTranslations = {
      'łazienka #': { uk: 'Ванна кімната #', ru: 'Ванная #' },
    }
    const painting = {
      id: 1,
      description: 'Malowanie ścian',
      descriptionTranslations: { uk: { text: 'Фарбування стін', source: 'Malowanie ścian' } },
    }

    it('reads the shared list and fills the section’s own number back in', () => {
      const translated = translateTree(treeOf([painting], 'Łazienka 2'), 'uk', sectionTranslations)

      expect(translated.sections[0].name).toBe('Ванна кімната 2')
      expect(descriptions(translated)).toEqual(['Фарбування стін'])
    })

    it('keeps a name nobody translated in Polish', () => {
      const translated = translateTree(treeOf([painting], 'Garderoba'), 'uk', sectionTranslations)

      expect(translated.sections[0].name).toBe('Garderoba')
    })

    it('leaves names and opisy alone for a Polish worker', () => {
      const tree = treeOf([painting], 'Łazienka 2')
      const translated = translateTree(tree, 'pl', sectionTranslations)

      expect(translated.sections[0].name).toBe('Łazienka 2')
      expect(descriptions(translated)).toEqual(['Malowanie ścian'])
    })
  })
})
