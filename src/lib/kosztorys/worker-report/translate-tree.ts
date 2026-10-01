import { translationText } from '@/lib/i18n/description-translations'
import type { LanguageT } from '@/lib/i18n/languages'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

// The worker reads opisy in their language; a pozycja nobody translated yet stays Polish rather than
// blank. A stale translation still shows — it is the closest thing they can read, and the owner sees
// it flagged in „Problemy". Ids are untouched, so the draft and the send key by the same rows.
export function translateTree(tree: KosztorysTreeT, locale: LanguageT): KosztorysTreeT {
  if (locale === 'pl') return tree
  return {
    ...tree,
    sections: tree.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        const text = translationText(item.descriptionTranslations, locale)
        return text.trim() === '' ? item : { ...item, description: text }
      }),
    })),
  }
}
