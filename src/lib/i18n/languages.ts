import { z } from 'zod'

// The single list every language-aware piece reads: a new language is one entry here plus one
// dictionary file, with no migration.
export const LANGUAGES = ['pl', 'uk', 'ru'] as const
export type LanguageT = (typeof LANGUAGES)[number]

export const DEFAULT_LANGUAGE: LanguageT = 'pl'

// Polish is the language the opis is typed in, so it never carries a translation of itself.
export type TranslationLanguageT = Exclude<LanguageT, 'pl'>
export const TRANSLATION_LANGUAGES = LANGUAGES.filter(
  (language): language is TranslationLanguageT => language !== 'pl',
)

export const LANGUAGE_LABELS: Record<LanguageT, string> = {
  pl: 'Polski',
  uk: 'Українська',
  ru: 'Русский',
}

// What a column label shows next to „Opis prac" — the country the crew knows, not the ISO code.
export const LANGUAGE_SHORT: Record<LanguageT, string> = {
  pl: 'PL',
  uk: 'UA',
  ru: 'RU',
}

export const languageSchema = z.enum(LANGUAGES)

export const isLanguage = (value: unknown): value is LanguageT =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)

export const isTranslationLanguage = (value: unknown): value is TranslationLanguageT =>
  isLanguage(value) && value !== 'pl'

// A stored worker language as the app reads it: anything unknown is no language at all.
export const toLanguage = (value: unknown): LanguageT | null => (isLanguage(value) ? value : null)
