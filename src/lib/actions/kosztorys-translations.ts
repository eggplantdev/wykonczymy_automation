'use server'

import { investmentAction } from '@/lib/actions/investment-action'
import { translateRows } from '@/lib/ai/translate-new-row'
import { getDb } from '@/lib/db/get-db'
import { bumpInvestmentRevision } from '@/lib/db/investment-revision'
import { fillDescriptionTranslations } from '@/lib/db/fill-description-translations'
import {
  getItemTexts,
  getSectionNames,
  getUnlinkedItemTexts,
  setItemTranslations,
} from '@/lib/db/kosztorys-item-texts'
import {
  listCatalogueItemsLinkedFrom,
  listCatalogueTranslationsByMatchKey,
} from '@/lib/db/work-catalogue'
import type { ActionResultT } from '@/types/action'
import { fillSectionNameTranslations } from './translate-section-name'

export type TranslationFillResultT = { items: number; sections: number; failed: number }

// Nothing is held open across the AI wait — the writers compare-and-set instead, so whatever a
// manager typed meanwhile wins.
//
// A szablon's linked prace show their katalog entry's opis (EX-1017), so that is what gets
// translated; only its unlinked rows still carry text of their own.
export async function fillKosztorysTranslationsAction(
  investmentId: number,
): Promise<ActionResultT<TranslationFillResultT>> {
  return investmentAction(
    'fillKosztorysTranslationsAction',
    { investmentId },
    async ({ payload, isTemplate }) => {
      const db = await getDb(payload)
      const [items, entries, catalogue, sectionNames] = await Promise.all([
        isTemplate ? getUnlinkedItemTexts(db, investmentId) : getItemTexts(db, investmentId),
        isTemplate ? listCatalogueItemsLinkedFrom(db, investmentId) : [],
        listCatalogueTranslationsByMatchKey(db),
        getSectionNames(db, investmentId),
      ])

      const [rows, linked, sections] = await Promise.all([
        translateRows(items, catalogue),
        translateRows(entries),
        fillSectionNameTranslations(db, sectionNames),
      ])
      const [written, writtenToCatalogue] = await Promise.all([
        setItemTranslations(db, investmentId, rows.writes),
        fillDescriptionTranslations(db, 'work_catalogue_items', linked.writes),
      ])
      // The grid reseeds off the szablon's revision token, which a katalog write leaves alone.
      if (writtenToCatalogue > 0) await bumpInvestmentRevision(db, investmentId)

      return {
        success: true,
        data: {
          items: written + writtenToCatalogue,
          sections: sections.written,
          failed: rows.failed + linked.failed + sections.failed,
        },
      }
    },
    ['kosztorysItems', 'sectionTranslations', 'workCatalogue'],
  )
}
