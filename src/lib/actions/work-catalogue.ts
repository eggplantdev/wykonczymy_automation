'use server'

import { z } from 'zod'
import { fillCatalogueTranslations } from '@/lib/ai/fill-catalogue-translations'
import { translateNewRow } from '@/lib/ai/translate-new-row'
import { SAVED_UNTRANSLATED_WARNING } from '@/lib/utils/notice'
import { getDb } from '@/lib/db/get-db'
import { markTemplatesHoldingCatalogueItemReplaced } from '@/lib/db/templates'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { findCatalogueItemByKey, listCatalogueItemsByIds } from '@/lib/db/work-catalogue'
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
        workNote: parsed.data.workNote,
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

      // The row being edited is excluded — otherwise saving it unchanged would collide with itself.
      const db = await getDb(payload)
      const holder = await findCatalogueItemByKey(db, row.matchKey)
      if (holder && holder.id !== id) return { success: false, error: DUPLICATE_ERROR }

      const stored = holder ?? (await listCatalogueItemsByIds(db, [id]))[0]
      await payload.update({
        collection: 'work-catalogue-items',
        id,
        data: {
          ...row,
          // Absent means a caller that never showed the field — leave the stored one alone.
          ...(parsed.data.workNote !== undefined && {
            workNote: parsed.data.workNote.trim() || null,
          }),
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

const updateCatalogueNoteSchema = z.object({
  catalogueItemId: z.number().int().positive(),
  text: z.string(),
})

// The Komentarz do pracy cell's own lane: one field, so a dialog opened on a stale katalog row
// cannot write that row's old prices back.
export async function updateCatalogueNoteAction(catalogueItemId: number, text: string) {
  return protectedAction(
    'updateCatalogueNoteAction',
    async ({ payload }) => {
      const parsed = validateAction(updateCatalogueNoteSchema, { catalogueItemId, text })
      if (!parsed.success) return parsed

      const note = parsed.data.text.trim()
      await payload.update({
        collection: 'work-catalogue-items',
        id: parsed.data.catalogueItemId,
        data: { workNote: note || null },
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
      // A kosztorys keeps its own copy (and the now dead id); a szablon's prace ARE their katalog
      // entries, so the FK cascade takes the praca out of every szablon.
      await withPayloadTransaction(
        payload,
        async (req) => {
          const db = await getDb(payload, req)
          await markTemplatesHoldingCatalogueItemReplaced(db, id)
          await payload.delete({ collection: 'work-catalogue-items', id, req })
        },
        { skipRevalidation: true },
      )

      return { success: true }
    },
    ['workCatalogue', 'presets'],
  )
}

const EMPTY_DESCRIPTION_ERROR = 'Praca bez opisu nie trafi do katalogu — najpierw ją nazwij.'
const EMPTY_UNIT_ERROR = 'Praca bez jednostki miary nie trafi do katalogu — najpierw uzupełnij j.m.'

// Only the BLIND save refuses an incomplete praca — it writes the candidate verbatim, so a missing
// j.m. would die on Payload's own validation and hand the owner a framework sentence.
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

      // The pozycja remembers what it was saved as, so the next „Aktualizuj" finds this entry even
      // after a rename in the katalog.
      await withPayloadTransaction(
        payload,
        async (req) => {
          const catalogueItemId = await applyCatalogueWrite(payload, req, {
            candidate,
            existing,
            keepCatalogueCategory: parsed.data.keepCatalogueCategory,
          })
          await payload.update({
            collection: 'kosztorys-items',
            id: parsed.data.itemId,
            data: { catalogueItemId },
            req,
          })
        },
        { skipRevalidation: true },
      )

      return { success: true }
    },
    ['workCatalogue', 'kosztorysItems'],
  )
}

export async function fillCatalogueTranslationsAction() {
  return protectedAction<{ items: number; failed: number }>(
    'fillCatalogueTranslationsAction',
    async ({ payload }) => {
      return { success: true, data: await fillCatalogueTranslations(await getDb(payload)) }
    },
    ['workCatalogue'],
  )
}
