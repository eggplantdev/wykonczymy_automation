import { z } from 'zod'
import {
  TRANSLATION_LANGUAGES,
  isTranslationLanguage,
  type TranslationLanguageT,
} from '@/lib/i18n/languages'

// `source` is the Polish opis the translation was made from. It is what makes a translation
// „out of date": the opis moved on and the translation did not.
export type DescriptionTranslationT = { text: string; source: string }

export type DescriptionTranslationsT = Partial<
  Record<TranslationLanguageT, DescriptionTranslationT>
>

const translationSchema = z.object({ text: z.string(), source: z.string() })

export const descriptionTranslationsSchema = z.partialRecord(
  z.enum(TRANSLATION_LANGUAGES),
  translationSchema,
)

// Reads whatever the DB or an old payload holds into the shape: unknown languages, malformed and
// empty entries are dropped rather than trusted, so a stray key never reaches a column or a worker.
export function toDescriptionTranslations(raw: unknown): DescriptionTranslationsT {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: DescriptionTranslationsT = {}
  for (const [language, entry] of Object.entries(raw)) {
    if (!isTranslationLanguage(language)) continue
    const parsed = translationSchema.safeParse(entry)
    if (parsed.success && parsed.data.text.trim() !== '') out[language] = parsed.data
  }
  return out
}

export const translationText = (
  translations: DescriptionTranslationsT | undefined,
  language: TranslationLanguageT,
): string => translations?.[language]?.text ?? ''

export const isTranslationStale = (
  translations: DescriptionTranslationsT | undefined,
  language: TranslationLanguageT,
  description: string | null | undefined,
): boolean => {
  const entry = translations?.[language]
  return entry != null && entry.source !== (description ?? '')
}

// Missing or out of date — the two Problemy conditions, and what the AI fill fills. A hand-typed
// translation that is current is never touched.
export const needsTranslation = (
  translations: DescriptionTranslationsT | undefined,
  language: TranslationLanguageT,
  description: string | null | undefined,
): boolean =>
  !!description?.trim() &&
  (translationText(translations, language) === '' ||
    isTranslationStale(translations, language, description))

// An empty text removes the language, so „bez tłumaczenia" and an emptied cell read the same.
export function withTranslation(
  translations: DescriptionTranslationsT | undefined,
  language: TranslationLanguageT,
  text: string,
  description: string | null | undefined,
): DescriptionTranslationsT {
  const next: DescriptionTranslationsT = { ...translations }
  if (text.trim() === '') delete next[language]
  else next[language] = { text, source: description ?? '' }
  return next
}

export type TranslationTextsT = Partial<Record<TranslationLanguageT, string>>

export const translationTexts = (
  translations: DescriptionTranslationsT | undefined,
): Record<TranslationLanguageT, string> =>
  Object.fromEntries(
    TRANSLATION_LANGUAGES.map((language) => [language, translationText(translations, language)]),
  ) as Record<TranslationLanguageT, string>

export const translationTextsSchema = z.partialRecord(z.enum(TRANSLATION_LANGUAGES), z.string())

export const changedTranslationTexts = (
  baseline: DescriptionTranslationsT | undefined,
  texts: TranslationTextsT | undefined,
): TranslationTextsT => {
  const changed: TranslationTextsT = {}
  for (const language of TRANSLATION_LANGUAGES) {
    const text = texts?.[language]
    if (text !== undefined && text !== translationText(baseline, language)) changed[language] = text
  }
  return changed
}

// Only a language whose text changed is stamped against the opis: an untouched one keeps its
// `source`, so saving an unrelated field cannot mark a stale translation current.
export function translationsFromTexts(
  baseline: DescriptionTranslationsT | undefined,
  texts: TranslationTextsT | undefined,
  description: string,
): DescriptionTranslationsT {
  const changed = changedTranslationTexts(baseline, texts)
  let next: DescriptionTranslationsT = { ...baseline }
  for (const language of TRANSLATION_LANGUAGES) {
    const text = changed[language]
    if (text !== undefined) next = withTranslation(next, language, text, description)
  }
  return next
}

// Per language, the incoming translation wins when it has one — unless it was made from another opis
// and the existing one matches `description`, the opis the merged map will sit under.
export function mergeTranslations(
  existing: DescriptionTranslationsT | undefined,
  incoming: DescriptionTranslationsT | undefined,
  description: string,
): DescriptionTranslationsT {
  const out: DescriptionTranslationsT = { ...existing }
  for (const language of TRANSLATION_LANGUAGES) {
    const entry = incoming?.[language]
    if (!entry || entry.text.trim() === '') continue
    const keepsExisting =
      entry.source !== description && existing?.[language]?.source === description
    if (!keepsExisting) out[language] = entry
  }
  return out
}

// A typo fix does not change meaning: a translation that was current against the old opis is
// current against the corrected one. One that was already out of date stays out of date.
export function restampTranslations(
  translations: DescriptionTranslationsT | undefined,
  oldDescription: string | null | undefined,
  newDescription: string | null | undefined,
): DescriptionTranslationsT {
  const out: DescriptionTranslationsT = { ...translations }
  for (const language of TRANSLATION_LANGUAGES) {
    const entry = out[language]
    if (entry && entry.source === (oldDescription ?? '')) {
      out[language] = { ...entry, source: newDescription ?? '' }
    }
  }
  return out
}
