'use server'

import { investmentAction } from '@/lib/actions/investment-action'
import { translateRows } from '@/lib/ai/translate-new-row'
import { getDb } from '@/lib/db/get-db'
import { getItemTexts, getSectionNames, setItemTranslations } from '@/lib/db/kosztorys-item-texts'
import { listCatalogueTranslationsByMatchKey } from '@/lib/db/work-catalogue'
import type { ActionResultT } from '@/types/action'
import { fillSectionNameTranslations } from './translate-section-name'

export type TranslationFillResultT = { items: number; sections: number; failed: number }

// Nothing is held open across the AI wait — the writers compare-and-set instead, so whatever a
// manager typed meanwhile wins.
export async function fillKosztorysTranslationsAction(
  investmentId: number,
): Promise<ActionResultT<TranslationFillResultT>> {
  return investmentAction(
    'fillKosztorysTranslationsAction',
    { investmentId },
    async ({ payload }) => {
      const db = await getDb(payload)
      const [items, catalogue, sectionNames] = await Promise.all([
        getItemTexts(db, investmentId),
        listCatalogueTranslationsByMatchKey(db),
        getSectionNames(db, investmentId),
      ])

      const [rows, sections] = await Promise.all([
        translateRows(items, catalogue),
        fillSectionNameTranslations(db, sectionNames),
      ])
      const written = await setItemTranslations(db, investmentId, rows.writes)

      return {
        success: true,
        data: { items: written, sections: sections.written, failed: rows.failed + sections.failed },
      }
    },
    ['kosztorysItems', 'sectionTranslations'],
  )
}
