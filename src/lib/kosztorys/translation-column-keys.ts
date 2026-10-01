import {
  TRANSLATION_LANGUAGES,
  isTranslationLanguage,
  type TranslationLanguageT,
} from '@/lib/i18n/languages'

// The translated-opis column key namespace, on the plane-price-keys.ts pattern: config (label, layer)
// resolves by the base key, visibility matches the full id. The id is persisted in stored column
// settings, so it is never renamed.
export const TRANSLATION_COLUMN_BASE_KEY = 'descriptionTranslation'

export type TranslationColumnKeyT = `descriptionTranslation__${TranslationLanguageT}`

const PREFIX = `${TRANSLATION_COLUMN_BASE_KEY}__`

export function translationColumnKey(language: TranslationLanguageT): TranslationColumnKeyT {
  return `${TRANSLATION_COLUMN_BASE_KEY}__${language}`
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

// The key the configuration maps are keyed by (label, layer, hidden default) — one entry for every
// language, so a new language needs no new config row.
export function baseTranslationColumnKey(key: string): string {
  return translationColumnLanguage(key) === null ? key : TRANSLATION_COLUMN_BASE_KEY
}
