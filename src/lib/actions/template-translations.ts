'use server'

import { templateAction } from '@/lib/actions/template-action'
import type { TranslationFillResultT } from '@/lib/actions/kosztorys-translations'
import { fillSectionNameTranslations } from '@/lib/actions/translate-section-name'
import { translateRows } from '@/lib/ai/translate-new-row'
import { fillDescriptionTranslations } from '@/lib/db/fill-description-translations'
import { getDb } from '@/lib/db/get-db'
import { getTemplateSectionNames } from '@/lib/db/template-structure'
import { bumpTemplateRevision } from '@/lib/db/templates'
import { listCatalogueItemsInTemplate } from '@/lib/db/work-catalogue'
import type { ActionResultT } from '@/types/action'

// A szablon praca's opis is its katalog entry's, so the katalog is what gets translated.
export async function fillTemplateTranslationsAction(
  templateId: number,
): Promise<ActionResultT<TranslationFillResultT>> {
  return templateAction(
    'fillTemplateTranslationsAction',
    { kind: 'template', id: templateId },
    async ({ payload }) => {
      const db = await getDb(payload)
      const [entries, sectionNames] = await Promise.all([
        listCatalogueItemsInTemplate(db, templateId),
        getTemplateSectionNames(db, templateId),
      ])
      const [linked, sections] = await Promise.all([
        translateRows(entries),
        fillSectionNameTranslations(db, sectionNames),
      ])
      const written = await fillDescriptionTranslations(db, 'work_catalogue_items', linked.writes)
      // The grid reseeds off the szablon's revision token, which a katalog write leaves alone.
      if (written > 0) await bumpTemplateRevision(db, templateId)

      return {
        success: true,
        data: {
          items: written,
          sections: sections.written,
          failed: linked.failed + sections.failed,
        },
      }
    },
    ['sectionTranslations', 'workCatalogue'],
  )
}
