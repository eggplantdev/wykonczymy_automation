'use server'

import { z } from 'zod'
import { getDb } from '@/lib/db/get-db'
import {
  deleteSectionTranslations,
  upsertSectionTranslations,
} from '@/lib/db/section-translations'
import {
  LANGUAGE_SHORT,
  TRANSLATION_LANGUAGES,
  type TranslationLanguageT,
} from '@/lib/i18n/languages'
import {
  sectionNameKey,
  toSectionTemplate,
  type SectionTemplateResultT,
  type SectionTranslationsT,
} from '@/lib/i18n/section-translations'
import { protectedAction, validateAction } from './run-action'

const inputSchema = z.object({
  sectionName: z.string().trim().min(1, 'Sekcja nie ma nazwy'),
  typed: z.object(
    Object.fromEntries(TRANSLATION_LANGUAGES.map((language) => [language, z.string()])) as Record<
      TranslationLanguageT,
      z.ZodString
    >,
  ),
})

function refusal(
  language: TranslationLanguageT,
  { reason, expected }: Extract<SectionTemplateResultT, { ok: false }>,
): string {
  const label = `Tłumaczenie (${LANGUAGE_SHORT[language]})`
  const numbers = expected.length ? `: ${expected.join(', ')}` : ''
  if (reason === 'hash') return `${label} nie może zawierać znaku „#" — wpisz liczby z nazwy sekcji${numbers}.`
  if (!expected.length) return `${label} nie może zawierać liczb — nazwa sekcji ich nie ma.`
  return `${label} musi zawierać te same liczby co nazwa sekcji${numbers}.`
}

/**
 * One entry of the shared list, written from a section's name — the key is derived here, so every
 * rozpiska with that name (whatever its number) reads what this save stores. The dialog always sends
 * every language, so the stored entry is replaced whole and an all-empty save removes it.
 */
export async function saveSectionTranslationsAction(
  sectionName: string,
  typed: Record<TranslationLanguageT, string>,
) {
  return protectedAction(
    'saveSectionTranslationsAction',
    async ({ payload }) => {
      const parsed = validateAction(inputSchema, { sectionName, typed })
      if (!parsed.success) return parsed

      const translations: SectionTranslationsT = {}
      for (const language of TRANSLATION_LANGUAGES) {
        const result = toSectionTemplate(parsed.data.sectionName, parsed.data.typed[language])
        if (!result.ok) return { success: false, error: refusal(language, result) }
        if (result.template) translations[language] = result.template
      }

      const db = await getDb(payload)
      const key = sectionNameKey(parsed.data.sectionName)
      if (Object.keys(translations).length === 0) await deleteSectionTranslations(db, key)
      else await upsertSectionTranslations(db, key, translations)

      return { success: true }
    },
    ['sectionTranslations'],
  )
}
