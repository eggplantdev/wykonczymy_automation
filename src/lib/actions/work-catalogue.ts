'use server'

import type { Payload } from 'payload'
import { z } from 'zod'
import { investmentAction } from '@/lib/actions/investment-action'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import {
  findCatalogueItemByKey,
  getCatalogueSourceItem,
  listCatalogueItemsByIds,
} from '@/lib/db/work-catalogue'
import { toCatalogueCandidate } from '@/lib/kosztorys/work-catalogue/item-to-catalogue'
import { buildCatalogueComparison } from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { stripLegacyMarker } from '@/lib/kosztorys/work-catalogue/legacy-marker'
import { appendCatalogueItems } from '@/lib/kosztorys/work-catalogue/append-catalogue-items'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { getWorkCatalogue } from '@/lib/queries/work-catalogue'
import type {
  AppendedCatalogueSliceT,
  CatalogueComparisonT,
  CatalogueSavePreviewT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import type { ActionResultT } from '@/types/action'
import {
  workCatalogueItemSchema,
  type WorkCatalogueItemDataT,
} from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { protectedAction, validateAction } from './run-action'

const MISSING_ITEM_ERROR = 'Nie znaleziono pozycji'

const DUPLICATE_ERROR = 'Praca o tej nazwie i jednostce już jest w katalogu.'

// Everything the collection stores, derived from the validated form data. `matchKey` is computed
// here and nowhere else — the UNIQUE index only means something if the value it guards is produced
// by the same folding every reader uses.
const toRow = (data: WorkCatalogueItemDataT) => ({
  description: data.description.trim(),
  category: data.category.trim() || null,
  unit: data.unit.trim(),
  clientPrice: data.clientPrice,
  wToolsRate: data.wToolsRate,
  ownToolsRate: data.ownToolsRate,
  matchKey: catalogueKey(data.description, data.unit),
})

export async function createCatalogueItemAction(data: WorkCatalogueItemDataT) {
  return protectedAction(
    'createCatalogueItemAction',
    async ({ payload }) => {
      const parsed = validateAction(workCatalogueItemSchema, data)
      if (!parsed.success) return parsed

      const row = toRow(parsed.data)

      // The unique index would refuse it anyway, but a Polish sentence beats a driver error —
      // and this is the ordinary path, not an edge case: the katalog exists to be typed into twice.
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

// TEMPORARY (owner review of the ~750 catalogue items pulled out of the old sheets): one click takes
// the „[stary arkusz]" note off a description, so the review does not go through the edit form for a
// change that is always the same. Goes away with the note itself, once the katalog is reviewed.
//
// `matchKey` is deliberately left alone: `catalogueKey` already strips the note, so the key this row
// holds is the one it will still hold afterwards — recomputing it would only invite a collision
// check for a value that cannot change.
export async function clearLegacyMarkerAction(id: number) {
  return protectedAction(
    'clearLegacyMarkerAction',
    async ({ payload }) => {
      const item = await payload.findByID({
        collection: 'work-catalogue-items',
        id,
        depth: 0,
        overrideAccess: true,
        // Without this a stale id throws Payload's own NotFound instead of resolving nullish, and
        // the owner gets a framework error where a Polish sentence belongs.
        disableErrors: true,
      })
      if (!item) return { success: false, error: MISSING_ITEM_ERROR }

      const description = stripLegacyMarker(item.description)
      if (description === item.description) return { success: true }

      await payload.update({ collection: 'work-catalogue-items', id, data: { description } })

      return { success: true }
    },
    ['workCatalogue'],
  )
}

export async function deleteCatalogueItemAction(id: number) {
  return protectedAction(
    'deleteCatalogueItemAction',
    async ({ payload }) => {
      // Nothing references a katalog row — prace copy the numbers at insert time and freeze them —
      // so a delete can never orphan a kosztorys.
      await payload.delete({ collection: 'work-catalogue-items', id })

      return { success: true }
    },
    ['workCatalogue'],
  )
}

// The cennik for the editor's picker — fetch-on-open, same cached read the /katalog-prac screen uses
// server-side, so both share one cache entry.
export async function listWorkCatalogueAction(): Promise<ActionResultT<WorkCatalogueItemT[]>> {
  return protectedAction('listWorkCatalogueAction', async () => {
    const data = await getWorkCatalogue()
    return { success: true, data }
  })
}

const insertCatalogueItemsSchema = z.object({
  sectionId: z.number().int().positive(),
  catalogueItemIds: z.array(z.number().int().positive()).min(1, 'Wybierz co najmniej jedną pracę'),
})

// „Dodaj → Praca z katalogu…". The client sends ONLY ids: every number that lands in the rozpiska is
// re-read from the cennik server-side, so a tampered payload cannot price a praca.
export async function insertCatalogueItemsAction(
  sectionId: number,
  catalogueItemIds: number[],
): Promise<ActionResultT<AppendedCatalogueSliceT>> {
  return investmentAction(
    'insertCatalogueItemsAction',
    { kind: 'section', id: sectionId },
    async ({ payload }) => {
      const parsed = validateAction(insertCatalogueItemsSchema, { sectionId, catalogueItemIds })
      if (!parsed.success) return parsed

      const db = await getDb(payload)
      // Deduped before the existence check: `listCatalogueItemsByIds` returns one row per REQUESTED
      // id, so `[5, 5, 5]` would pass the length test and append the same praca three times.
      const ids = [...new Set(parsed.data.catalogueItemIds)]
      const items = await listCatalogueItemsByIds(db, ids)
      if (items.length !== ids.length)
        return { success: false, error: 'Część wybranych prac nie istnieje już w katalogu.' }

      const created = await withPayloadTransaction(
        payload,
        (req) => appendCatalogueItems(payload, req, parsed.data.sectionId, items),
        { skipRevalidation: true },
      )
      if (!created) return { success: false, error: 'Nie znaleziono sekcji' }

      return { success: true, data: created }
    },
    ['kosztorysItems'],
  )
}

const EMPTY_DESCRIPTION_ERROR = 'Praca bez opisu nie trafi do katalogu — najpierw ją nazwij.'
// The katalog row requires a j.m. (it is half the klucz), so without this the save died on Payload's
// own validation and the owner got a framework sentence instead of the fix.
const EMPTY_UNIT_ERROR = 'Praca bez jednostki miary nie trafi do katalogu — najpierw uzupełnij j.m.'

// Both „Zapisz do katalogu…" paths start here: the numbers are derived from the pozycja in the DB,
// never from the wire, so the dialog's preview and the save can never disagree about what is saved.
// The refusals live here too — a caller that only got the figures back would have to re-run them, and
// the preview and the save would drift the moment one of them forgot.
async function catalogueSaveState(
  payload: Payload,
  itemId: number,
): Promise<CatalogueSavePreviewT | { error: string }> {
  const db = await getDb(payload)
  const source = await getCatalogueSourceItem(db, itemId)
  if (!source) return { error: MISSING_ITEM_ERROR }

  const candidate = toCatalogueCandidate(source)
  if (!candidate.description) return { error: EMPTY_DESCRIPTION_ERROR }
  if (!candidate.unit) return { error: EMPTY_UNIT_ERROR }

  const existing = await findCatalogueItemByKey(db, candidate.matchKey)
  return { candidate, existing: existing ?? null }
}

// Fetch-on-open for the dialog: what would be written, and what is already there under that klucz.
export async function catalogueSavePreviewAction(
  itemId: number,
): Promise<ActionResultT<CatalogueSavePreviewT>> {
  return protectedAction('catalogueSavePreviewAction', async ({ payload }) => {
    const state = await catalogueSaveState(payload, itemId)
    if ('error' in state) return { success: false, error: state.error }

    return { success: true, data: state }
  })
}

const saveItemToCatalogueSchema = z.object({
  itemId: z.number().int().positive(),
  mode: z.enum(['new', 'overwrite']),
  keepCatalogueCategory: z.boolean(),
})

// The way back from a rozpiska into the cennik. `'overwrite'` updates the row holding the klucz in
// place — same id, same `created_at` — because the katalog entry is the same praca, re-priced.
//
// `keepCatalogueCategory` defaults to protecting the cennik: the candidate's kategoria comes from
// THIS kosztorys' sekcja, which is one investment's local context, while the katalog owns its own
// classification. Reclassifying has to be asked for.
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

      if (parsed.data.mode === 'overwrite') {
        // The row may have been deleted between opening the dialog and confirming — then the
        // overwrite IS a create, and refusing it would be pedantry about a race nobody caused.
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

// „Porównaj z katalogiem" — a read, and only a read: it says where the rozpiska and the cennik
// disagree and writes nothing either way. Both sides come from their own cached reads, so opening
// the report costs one tree read and nothing else.
export async function compareWithCatalogueAction(
  investmentId: number,
): Promise<ActionResultT<CatalogueComparisonT>> {
  return protectedAction('compareWithCatalogueAction', async () => {
    const [tree, catalogue] = await Promise.all([
      getKosztorysTree(investmentId),
      getWorkCatalogue(),
    ])
    const items = tree.sections.flatMap((section) =>
      section.items.map((item) => ({ ...item, sectionName: section.name })),
    )

    return {
      success: true,
      data: buildCatalogueComparison(items, catalogue, {
        wToolsCoeff: tree.globalCoeffs.wTools,
        ownToolsCoeff: tree.globalCoeffs.ownTools,
      }),
    }
  })
}
