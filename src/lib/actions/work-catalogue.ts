'use server'

import { z } from 'zod'
import { catalogueSaveState } from '@/lib/queries/work-catalogue'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { CatalogueSeedItemT } from '@/lib/kosztorys/work-catalogue/types'
import {
  workCatalogueItemSchema,
  type WorkCatalogueItemDataT,
} from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { protectedAction, validateAction } from './run-action'

const DUPLICATE_ERROR = 'Praca o tej nazwie i jednostce już jest w katalogu.'

// `matchKey` is computed here and nowhere else — the UNIQUE index only means something if the value
// it guards comes from the same folding every reader uses.
const toRow = (data: WorkCatalogueItemDataT) => ({
  description: data.description.trim(),
  category: data.category.trim() || null,
  unit: data.unit.trim(),
  clientPrice: data.clientPrice,
  wToolsRate: data.wToolsRate,
  wToolsRateCoeff: data.wToolsRateCoeff,
  ownToolsRate: data.ownToolsRate,
  ownToolsRateCoeff: data.ownToolsRateCoeff,
  matchKey: catalogueKey(data.description, data.unit),
})

export async function createCatalogueItemAction(data: WorkCatalogueItemDataT) {
  return protectedAction(
    'createCatalogueItemAction',
    async ({ payload }) => {
      const parsed = validateAction(workCatalogueItemSchema, data)
      if (!parsed.success) return parsed

      const row = toRow(parsed.data)

      // The unique index would refuse it anyway, but a Polish sentence beats a driver error — and
      // this is the ordinary path: the katalog exists to be typed into twice.
      const existing = await payload.find({
        collection: 'work-catalogue-items',
        where: { matchKey: { equals: row.matchKey } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return { success: false, error: DUPLICATE_ERROR }

      await payload.create({ collection: 'work-catalogue-items', data: row })

      return { success: true }
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

      const row = toRow(parsed.data)

      // Editing the opis or j.m. re-derives the key, so an edit can collide exactly like a create.
      // The row being edited is excluded — otherwise saving it unchanged would collide with itself.
      const existing = await payload.find({
        collection: 'work-catalogue-items',
        where: { and: [{ matchKey: { equals: row.matchKey } }, { id: { not_equals: id } }] },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) return { success: false, error: DUPLICATE_ERROR }

      await payload.update({ collection: 'work-catalogue-items', id, data: row })

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

// `'overwrite'` updates the row holding the klucz in place — same id, same `created_at` — because
// the katalog entry is the same praca, re-priced.
//
// `keepCatalogueCategory` defaults to protecting the cennik: the candidate's kategoria comes from
// THIS kosztorys' sekcja, one investment's local context, while the katalog owns its own.
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

      if (parsed.data.mode === 'overwrite') {
        // Deleted between opening the dialog and confirming: the overwrite IS a create, and refusing
        // it would be pedantry about a race nobody caused.
        if (!existing) {
          await payload.create({ collection: 'work-catalogue-items', data: candidate })
          return { success: true }
        }
        await payload.update({
          collection: 'work-catalogue-items',
          id: existing.id,
          data: parsed.data.keepCatalogueCategory
            ? { ...candidate, category: existing.category }
            : candidate,
        })
        return { success: true }
      }

      if (existing) return { success: false, error: DUPLICATE_ERROR }

      await payload.create({ collection: 'work-catalogue-items', data: candidate })

      return { success: true }
    },
    ['workCatalogue'],
  )
}
