import {
  TRANSLATION_LANGUAGES,
  isTranslationLanguage,
  type TranslationLanguageT,
} from '@/lib/i18n/languages'

// The id is persisted in stored column settings, so it is never renamed.
const PREFIX = 'descriptionTranslation__'

export type TranslationColumnKeyT = `${typeof PREFIX}${TranslationLanguageT}`

export function translationColumnKey(language: TranslationLanguageT): TranslationColumnKeyT {
  return `${PREFIX}${language}`
}

// An unknown suffix resolves to null rather than a default language: a wrong language would read
// and WRITE another language's translation.
export function translationColumnLanguage(key: string): TranslationLanguageT | null {
  if (!key.startsWith(PREFIX)) return null
  const language = key.slice(PREFIX.length)
  return isTranslationLanguage(language) ? language : null
}

export const ALL_TRANSLATION_COLUMN_KEYS: readonly TranslationColumnKeyT[] =
  TRANSLATION_LANGUAGES.map(translationColumnKey)
