import { describe, expect, it } from 'vitest'
import { translateTree } from '@/lib/i18n/translate-tree'
import type { DescriptionTranslationsT } from '@/lib/i18n/description-translations'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

function treeOf(
  items: { id: number; description: string; descriptionTranslations?: DescriptionTranslationsT }[],
): KosztorysTreeT {
  return { sections: [{ id: 1, name: 'Łazienka', items }] } as unknown as KosztorysTreeT
}

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

    expect(descriptions(translateTree(tree, 'uk'))).toEqual(['Фарбування стін'])
    expect(descriptions(translateTree(tree, 'ru'))).toEqual(['Покраска стен'])
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

    expect(descriptions(translateTree(tree, 'uk'))).toEqual(['Malowanie ścian', 'Gruntowanie'])
  })

  it('still shows a translation made from an older opis', () => {
    const tree = treeOf([
      {
        id: 1,
        description: 'Malowanie ścian dwukrotnie',
        descriptionTranslations: { uk: { text: 'Фарбування стін', source: 'Malowanie ścian' } },
      },
    ])

    expect(descriptions(translateTree(tree, 'uk'))).toEqual(['Фарбування стін'])
  })

  it('keeps every pozycja id, so the draft and the send key by the same rows', () => {
    const tree = treeOf([
      {
        id: 7,
        description: 'Malowanie ścian',
        descriptionTranslations: { uk: { text: 'Фарбування стін', source: 'Malowanie ścian' } },
      },
    ])

    expect(translateTree(tree, 'uk').sections[0].items[0].id).toBe(7)
  })

  it('hands a Polish worker the tree untouched', () => {
    const tree = treeOf([{ id: 1, description: 'Malowanie ścian' }])

    expect(translateTree(tree, 'pl')).toBe(tree)
  })
})
