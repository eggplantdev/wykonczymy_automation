'use server'

import { z } from 'zod'
import { translateNewRow, translateRows } from '@/lib/ai/translate-new-row'
import { SAVED_UNTRANSLATED_WARNING } from '@/lib/utils/notice'
import { fillDescriptionTranslations } from '@/lib/db/fill-description-translations'
import { getDb } from '@/lib/db/get-db'
import {
  findCatalogueItemByKey,
  listCatalogueItems,
  listCatalogueItemsByIds,
} from '@/lib/db/work-catalogue'
import { translationsFromTexts } from '@/lib/i18n/description-translations'
import { catalogueSaveState } from '@/lib/queries/work-catalogue'
import type { CatalogueSeedItemT } from '@/lib/kosztorys/work-catalogue/types'
import {
  applyCatalogueWrite,
  catalogueRow,
  DUPLICATE_ERROR,
  duplicateRefusal,
  resolveCatalogueWrite,
} from '@/lib/kosztorys/work-catalogue/write-catalogue-entry'
import {
  workCatalogueItemSchema,
  type WorkCatalogueItemDataT,
} from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { protectedAction, validateAction } from './run-action'

export async function createCatalogueItemAction(data: WorkCatalogueItemDataT, translate = false) {
  return protectedAction(
    'createCatalogueItemAction',
    async ({ payload }) => {
      const parsed = validateAction(workCatalogueItemSchema, data)
      if (!parsed.success) return parsed

      const row = catalogueRow(parsed.data)
      const resolved = await resolveCatalogueWrite(await getDb(payload), row.matchKey, 'new')
      if ('error' in resolved) return { success: false, error: resolved.error }

      const typed = translationsFromTexts(
        parsed.data.translationSeed,
        parsed.data.translationEdits,
        row.description,
      )
      const translated = translate
        ? await translateNewRow({
            description: row.description,
            unit: row.unit,
            descriptionTranslations: typed,
          })
        : { translations: typed, failed: false }

      await applyCatalogueWrite(payload, undefined, {
        candidate: { ...row, descriptionTranslations: translated.translations },
        existing: null,
        keepCatalogueCategory: true,
      })

      return translated.failed
        ? { success: true, warning: SAVED_UNTRANSLATED_WARNING }
        : { success: true }
    },
    ['workCatalogue'],
  )
}

export async function updateCatalogueItemAction(id: number, data: WorkCatalogueItemDataT) {
  return protectedAction(
    'updateCatalogueItemAction',
    async ({ payload }) => {
      const parsed = validateAction(workCatalogueItemSchema, data)
      if (!parsed.success) return parsed

      const row = catalogueRow(parsed.data)

      // Editing the opis or j.m. re-derives the key, so an edit can collide exactly like a create.
      // The row being edited is excluded — otherwise saving it unchanged would collide with itself.
      const db = await getDb(payload)
      const holder = await findCatalogueItemByKey(db, row.matchKey)
      if (holder && holder.id !== id) return { success: false, error: DUPLICATE_ERROR }

      // An edit that keeps the opis and j.m. finds its own row as the holder — the common price-only save.
      const stored = holder ?? (await listCatalogueItemsByIds(db, [id]))[0]
      await payload.update({
        collection: 'work-catalogue-items',
        id,
        data: {
          ...row,
          descriptionTranslations: translationsFromTexts(
            stored?.descriptionTranslations,
            parsed.data.translationEdits,
            row.description,
          ),
        },
      })

      return { success: true }
    },
    ['workCatalogue'],
  )
}

export async function deleteCatalogueItemAction(id: number) {
  return protectedAction(
    'deleteCatalogueItemAction',
    async ({ payload }) => {
      // Prace copy the numbers at insert time and freeze them, so a delete can't orphan a kosztorys.
      await payload.delete({ collection: 'work-catalogue-items', id })

      return { success: true }
    },
    ['workCatalogue'],
  )
}

const EMPTY_DESCRIPTION_ERROR = 'Praca bez opisu nie trafi do katalogu — najpierw ją nazwij.'
// The j.m. is half the klucz, so without this the save died on Payload's own validation and the
// owner got a framework sentence instead of the fix.
const EMPTY_UNIT_ERROR = 'Praca bez jednostki miary nie trafi do katalogu — najpierw uzupełnij j.m.'

// Only the BLIND save refuses an incomplete praca — it writes the candidate verbatim, so a missing
// j.m. would die on Payload's own validation and hand the owner a framework sentence. The preview
// deliberately does not: the form it fills is the place where the missing j.m. gets typed in, and
// refusing there would be an error message with nowhere to go and fix it.
function incompleteCandidateError(candidate: CatalogueSeedItemT): string | null {
  if (!candidate.description) return EMPTY_DESCRIPTION_ERROR
  if (!candidate.unit) return EMPTY_UNIT_ERROR
  return null
}

const saveItemToCatalogueSchema = z.object({
  itemId: z.number().int().positive(),
  mode: z.enum(['new', 'overwrite']),
  keepCatalogueCategory: z.boolean(),
})

export async function saveItemToCatalogueAction(
  itemId: number,
  mode: 'new' | 'overwrite',
  keepCatalogueCategory = true,
) {
  return protectedAction(
    'saveItemToCatalogueAction',
    async ({ payload }) => {
      const parsed = validateAction(saveItemToCatalogueSchema, {
        itemId,
        mode,
        keepCatalogueCategory,
      })
      if (!parsed.success) return parsed

      const state = await catalogueSaveState(payload, parsed.data.itemId)
      if ('error' in state) return { success: false, error: state.error }

      const { candidate, existing } = state
      const incomplete = incompleteCandidateError(candidate)
      if (incomplete) return { success: false, error: incomplete }

      const refusal = duplicateRefusal(existing, parsed.data.mode)
      if (refusal) return { success: false, error: refusal }

      await applyCatalogueWrite(payload, undefined, {
        candidate,
        existing,
        keepCatalogueCategory: parsed.data.keepCatalogueCategory,
      })

      return { success: true }
    },
    ['workCatalogue'],
  )
}

export async function fillCatalogueTranslationsAction() {
  return protectedAction<{ items: number; failed: number }>(
    'fillCatalogueTranslationsAction',
    async ({ payload }) => {
      const db = await getDb(payload)
      const { writes, failed } = await translateRows(await listCatalogueItems(db))
      const written = await fillDescriptionTranslations(db, 'work_catalogue_items', writes)
      return { success: true, data: { items: written, failed } }
    },
    ['workCatalogue'],
  )
}
