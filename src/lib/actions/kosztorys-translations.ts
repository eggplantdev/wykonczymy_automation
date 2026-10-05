'use server'

import { investmentAction } from '@/lib/actions/investment-action'
import { translateTexts } from '@/lib/ai/translate'
import { getDb } from '@/lib/db/get-db'
import { getItemTexts, getSectionNames, setItemTranslations } from '@/lib/db/kosztorys-item-texts'
import { fillSectionTranslations, listSectionTranslations } from '@/lib/db/section-translations'
import { listCatalogueTranslationsByMatchKey } from '@/lib/db/work-catalogue'
import {
  aiFillWrites,
  mergeRowWrites,
  planAiFill,
  sectionLanguagesToFill,
  sectionTemplatesFromAi,
} from '@/lib/i18n/ai-translation-fill'
import { sectionNameKey } from '@/lib/i18n/section-translations'
import type { ActionResultT } from '@/types/action'

export type TranslationFillResultT = { items: number; sections: number; failed: number }

/**
 * „Uzupełnij tłumaczenia (AI)": every missing or out-of-date opis translation and every section name
 * with no template. Nothing is held open across the AI wait — the writers compare-and-set instead,
 * so whatever a manager typed meanwhile wins.
 */
export async function fillKosztorysTranslationsAction(
  investmentId: number,
): Promise<ActionResultT<TranslationFillResultT>> {
  return investmentAction(
    'fillKosztorysTranslationsAction',
    { investmentId },
    async ({ payload }) => {
      const db = await getDb(payload)
      const [items, catalogue, sectionNames, sectionTranslations] = await Promise.all([
        getItemTexts(db, investmentId),
        listCatalogueTranslationsByMatchKey(db),
        getSectionNames(db, investmentId),
        listSectionTranslations(db),
      ])

      const plan = planAiFill(
        items.map((item) => ({ ...item, translations: item.descriptionTranslations })),
        catalogue,
      )
      // One name per key: „Łazienka 1" and „Łazienka 2" share a template, so translating both is waste.
      const sections = new Map<string, string>()
      for (const name of sectionNames) {
        const key = sectionNameKey(name)
        if (!sections.has(key) && sectionLanguagesToFill(sectionTranslations[key]).length > 0) {
          sections.set(key, name.trim())
        }
      }

      const ai = await translateTexts([
        ...plan.toTranslate.map(({ text }) => text),
        ...sections.values(),
      ])

      const { writes, failed: failedItems } = aiFillWrites(plan.toTranslate, ai)
      const written = await setItemTranslations(
        db,
        investmentId,
        mergeRowWrites([...plan.fromCatalogue, ...writes]),
      )

      let sectionsWritten = 0
      let failedSections = 0
      for (const [key, name] of sections) {
        const languages = sectionLanguagesToFill(sectionTranslations[key])
        const templates = sectionTemplatesFromAi(name, ai.get(name))
        const filled = Object.fromEntries(
          languages.filter((language) => templates[language]).map((l) => [l, templates[l]]),
        )
        failedSections += languages.length - Object.keys(filled).length
        if (Object.keys(filled).length === 0) continue
        await fillSectionTranslations(db, key, filled)
        sectionsWritten++
      }

      return {
        success: true,
        data: { items: written, sections: sectionsWritten, failed: failedItems + failedSections },
      }
    },
    ['kosztorysItems', 'sectionTranslations'],
  )
}
