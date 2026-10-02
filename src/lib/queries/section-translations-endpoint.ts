'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { TRANSLATION_LANGUAGES, type TranslationLanguageT } from '@/lib/i18n/languages'
import { renderSectionName, sectionNameKey } from '@/lib/i18n/section-translations'
import type { ActionResultT } from '@/types/action'
import { getSectionTranslations } from './section-translations'

// What the worker would see for THIS section, numbers filled in — so the manager edits real text.
// An untranslated language is '', never the Polish fallback: an empty field must mean "none".
export async function getSectionTranslationForName(
  sectionName: string,
): Promise<ActionResultT<Record<TranslationLanguageT, string>>> {
  return protectedAction('getSectionTranslationForName', async () => {
    const entry = (await getSectionTranslations())[sectionNameKey(sectionName)]
    const data = Object.fromEntries(
      TRANSLATION_LANGUAGES.map((language) => [
        language,
        renderSectionName(sectionName, entry, language) ?? '',
      ]),
    ) as Record<TranslationLanguageT, string>

    return { success: true, data }
  })
}
