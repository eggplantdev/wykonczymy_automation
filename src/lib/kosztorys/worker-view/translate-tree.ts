import { translationText } from '@/lib/i18n/description-translations'
import type { LanguageT } from '@/lib/i18n/languages'
import {
  renderSectionName,
  sectionNameKey,
  type SectionTranslationMapT,
} from '@/lib/i18n/section-translations'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { translateUnit } from '@/lib/kosztorys/worker-view/translate-unit'

export function translateTree(
  tree: KosztorysTreeT,
  locale: LanguageT,
  sectionTranslations: SectionTranslationMapT,
): KosztorysTreeT {
  if (locale === 'pl') return tree
  return {
    ...tree,
    sections: tree.sections.map((section) => ({
      ...section,
      name:
        renderSectionName(
          section.name,
          sectionTranslations[sectionNameKey(section.name)],
          locale,
        ) ?? section.name,
      items: section.items.map((item) => {
        const text = translationText(item.descriptionTranslations, locale)
        return {
          ...item,
          description: text.trim() === '' ? item.description : text,
          unit: item.unit === null ? null : translateUnit(item.unit, locale),
        }
      }),
    })),
  }
}
