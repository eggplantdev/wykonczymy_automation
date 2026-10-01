import { withTranslation } from '@/lib/i18n/description-translations'
import type { TranslationLanguageT } from '@/lib/i18n/languages'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// The whole map travels in the patch, because a json column is replaced, not merged.
export function withRowTranslation(
  row: KosztorysV2RowT,
  language: TranslationLanguageT,
  text: string | null,
): KosztorysV2RowT {
  return {
    ...row,
    descriptionTranslations: withTranslation(
      row.descriptionTranslations,
      language,
      text ?? '',
      row.description,
    ),
  }
}
