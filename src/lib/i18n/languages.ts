import { z } from 'zod'

// The single list every language-aware piece reads: a new language is one entry here plus one
// dictionary file, with no migration.
export const LANGUAGES = ['pl', 'uk', 'ru'] as const
export type LanguageT = (typeof LANGUAGES)[number]

export const DEFAULT_LANGUAGE: LanguageT = 'pl'

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

// Polish is the absence of a language on an account: storing 'pl' would make two values mean the same thing.
export const storedLanguageSchema = languageSchema
  .nullable()
  .transform((language) => (language === DEFAULT_LANGUAGE ? null : language))

export const isLanguage = (value: unknown): value is LanguageT =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)

export const isTranslationLanguage = (value: unknown): value is TranslationLanguageT =>
  isLanguage(value) && value !== 'pl'

export const toLanguage = (value: unknown): LanguageT | null => (isLanguage(value) ? value : null)

// Per worker, not per device: a phone passed between two of the crew must not carry one's choice
// into the other's link.
export const reportLanguageStorageKey = (workerId: number) => `worker-report-lang:${workerId}`
