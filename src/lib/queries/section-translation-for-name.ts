'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { TRANSLATION_LANGUAGES, type TranslationLanguageT } from '@/lib/i18n/languages'
import { renderSectionName, sectionNameKey } from '@/lib/i18n/section-translations'
import { getSectionTranslations } from './section-translations'

// What the worker would see for THIS section, numbers filled in — so the manager edits real text.
// An untranslated language is '', never the Polish fallback: an empty field must mean "none".
export async function getSectionTranslationForName(
  sectionName: string,
): Promise<Record<TranslationLanguageT, string>> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  const entry = (await getSectionTranslations())[sectionNameKey(sectionName)]
  return Object.fromEntries(
    TRANSLATION_LANGUAGES.map((language) => [
      language,
      entry?.[language] ? renderSectionName(sectionName, entry, language) : '',
    ]),
  ) as Record<TranslationLanguageT, string>
}
