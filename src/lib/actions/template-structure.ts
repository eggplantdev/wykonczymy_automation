'use server'

import { after } from 'next/server'
import { z } from 'zod'
import { templateAction } from '@/lib/actions/template-action'
import { translateSectionName } from '@/lib/actions/translate-section-name'
import { validateAction } from '@/lib/actions/run-action'
import { translateNewRow } from '@/lib/ai/translate-new-row'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import {
  deleteTemplateItem,
  deleteTemplateSection,
  insertTemplateItems,
  insertTemplateSection,
  templateSectionAndNextItemOrder,
  templateSectionIdByName,
  updateTemplateSection,
} from '@/lib/db/template-structure'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { findCatalogueItemByKey, findTemplateItemCatalogueEntry } from '@/lib/db/work-catalogue'
import { addItemSchema, TEMPLATE_ITEM_NEEDS_CATALOGUE, type AddItemInputT } from '@/lib/kosztorys/add-item-schema'
import { DEFAULT_SECTION_NAME } from '@/lib/kosztorys/constants'
import type { CreatedSectionT } from '@/lib/kosztorys/create-section'
import {
  insertDirectionSchema,
  resolveInsertSlot,
  shiftDisplayOrderFrom,
  type InsertDirectionT,
} from '@/lib/kosztorys/display-order'
import { itemFromFields } from '@/lib/kosztorys/item-from-fields'
import { itemPatchSchema } from '@/lib/kosztorys/item-patch-schema'
import { normalizeOverridePatch } from '@/lib/kosztorys/override-patch'
import { sectionPatchSchema, type SectionPatchT } from '@/lib/kosztorys/section-patch-schema'
import { ceilingWarnings } from '@/lib/kosztorys/subcontractor-price-guard'
import type { ItemPatchT, KosztorysItemT, KosztorysSectionT, NewItemPlacementT } from '@/lib/kosztorys/types'
import {
  catalogueUpdateFor,
  EMPTY_ITEM_TEXT_ERROR,
  splitTemplatePatch,
} from '@/lib/kosztorys/work-catalogue/template-catalogue-patch'
import {
  createSectionWithCatalogueItemsSchema,
  insertCatalogueItemsSchema,
  readCatalogueItems,
} from '@/lib/kosztorys/work-catalogue/read-catalogue-items'
import type {
  AppendedCatalogueSliceT,
  NewSectionCatalogueSliceT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import {
  applyCatalogueWrite,
  catalogueRow,
  DUPLICATE_ERROR,
  resolveCatalogueWrite,
} from '@/lib/kosztorys/work-catalogue/write-catalogue-entry'
import { SAVED_UNTRANSLATED_WARNING } from '@/lib/utils/notice'
import type { ActionResultT } from '@/types/action'

// The szablon plane's twins of the structural writes in `kosztorys.ts`. A szablon praca is a link to
// its katalog entry and nothing else, so every editable column of the grid is a katalog field.

const SECTION_MISSING = 'Sekcja nie istnieje.'
const ITEM_MISSING = 'Pozycja nie istnieje.'

// A przedmiar, rabat or uwaga typed into a szablon has nowhere to live — the row carries only its
// link — so that half of the patch is dropped rather than refused, like the grid never offering it.
export async function updateTemplateItemFieldAction(itemId: number, patch: ItemPatchT) {
  return templateAction(
    'updateTemplateItemFieldAction',
    { kind: 'item', id: itemId },
    async ({ payload }) => {
      const parsed = validateAction(itemPatchSchema, patch)
      if (!parsed.success) return parsed
      const { cataloguePatch } = splitTemplatePatch(normalizeOverridePatch(parsed.data))
      if (Object.keys(cataloguePatch).length === 0) return { success: true }

      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const txDb = await getDb(payload, req)
          const entry = await findTemplateItemCatalogueEntry(txDb, itemId)
          if (!entry) return { success: false, error: ITEM_MISSING, code: 'NOT_FOUND' }
          const update = catalogueUpdateFor(entry, cataloguePatch)
          if ('error' in update) return { success: false, error: update.error }
          // Before the write: a returned refusal still commits the transaction.
          const { matchKey } = update.data
          if (matchKey && matchKey !== entry.matchKey) {
            const holder = await findCatalogueItemByKey(txDb, matchKey)
            if (holder && holder.id !== entry.id) return { success: false, error: DUPLICATE_ERROR }
          }
          await payload.update({
            collection: 'work-catalogue-items',
            id: entry.id,
            data: update.data,
            req,
          })
          return { success: true }
        },
        { skipRevalidation: true },
      )
    },
    ['workCatalogue'],
    { deferRefresh: true },
  )
}

export async function updateTemplateSectionFieldAction(sectionId: number, patch: SectionPatchT) {
  return templateAction(
    'updateTemplateSectionFieldAction',
    { kind: 'section', id: sectionId },
    async ({ payload }) => {
      const parsed = validateAction(sectionPatchSchema, patch)
      if (!parsed.success) return parsed
      await updateTemplateSection(await getDb(payload), sectionId, parsed.data)
      const { name } = parsed.data
      if (name !== undefined) after(() => translateSectionName(payload, name))
      return { success: true }
    },
    undefined,
    { deferRefresh: true },
  )
}

// Same top placement and the same empty-szablon tie as `addSectionAction`.
export async function addTemplateSectionAction(
  templateId: number,
): Promise<ActionResultT<CreatedSectionT>> {
  return templateAction(
    'addTemplateSectionAction',
    { kind: 'template', id: templateId },
    async ({ payload }) => {
      const id = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          await shiftDisplayOrderFrom(txDb, 'template-sections', templateId, 0)
          return insertTemplateSection(txDb, templateId, DEFAULT_SECTION_NAME, 0)
        },
        { skipRevalidation: true },
      )
      return { success: true, data: { section: { id, displayOrder: 0 } } }
    },
  )
}

const insertSectionSchema = z.object({
  anchorSectionId: z.number(),
  dir: insertDirectionSchema,
})

export async function insertTemplateSectionAction(
  anchorSectionId: number,
  dir: InsertDirectionT,
): Promise<ActionResultT<CreatedSectionT>> {
  return templateAction(
    'insertTemplateSectionAction',
    { kind: 'section', id: anchorSectionId },
    async ({ payload }) => {
      const parsed = validateAction(insertSectionSchema, { anchorSectionId, dir })
      if (!parsed.success) return parsed
      const created = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          const slot = await resolveInsertSlot(
            txDb,
            'template-sections',
            parsed.data.anchorSectionId,
            parsed.data.dir,
          )
          if (!slot) return undefined
          await shiftDisplayOrderFrom(txDb, 'template-sections', slot.ownerId, slot.at)
          const id = await insertTemplateSection(txDb, slot.ownerId, DEFAULT_SECTION_NAME, slot.at)
          return { section: { id, displayOrder: slot.at } }
        },
        { skipRevalidation: true },
      )
      if (!created) return { success: false, error: SECTION_MISSING }
      return { success: true, data: created }
    },
  )
}

export async function removeTemplateSectionAction(sectionId: number): Promise<ActionResultT> {
  return templateAction(
    'removeTemplateSectionAction',
    { kind: 'section', id: sectionId },
    async ({ payload }) => {
      await deleteTemplateSection(await getDb(payload), sectionId)
      return { success: true }
    },
  )
}

export async function removeTemplateItemAction(itemId: number): Promise<ActionResultT> {
  return templateAction(
    'removeTemplateItemAction',
    { kind: 'item', id: itemId },
    async ({ payload }) => {
      await deleteTemplateItem(await getDb(payload), itemId)
      return { success: true }
    },
  )
}

async function resolveNewTemplateItemSlot(
  db: DbExecutorT,
  placement: NewItemPlacementT,
): Promise<{ sectionId: number; displayOrder: number } | { error: string }> {
  if (placement.kind === 'end') {
    const owner = await templateSectionAndNextItemOrder(db, placement.sectionId)
    if (!owner) return { error: SECTION_MISSING }
    return { sectionId: placement.sectionId, displayOrder: owner.nextDisplayOrder }
  }
  const slot = await resolveInsertSlot(db, 'template-items', placement.anchorItemId, placement.dir)
  if (!slot) return { error: ITEM_MISSING }
  await shiftDisplayOrderFrom(db, 'template-items', slot.ownerId, slot.at)
  return { sectionId: slot.ownerId, displayOrder: slot.at }
}

// „Nowa praca" in a szablon always goes through the katalog: the row it creates is only a link, so
// a praca with no katalog entry would have no content at all.
export async function addTemplateItemAction(
  input: AddItemInputT,
): Promise<ActionResultT<{ item: KosztorysItemT }>> {
  const target =
    input.placement.kind === 'end'
      ? { kind: 'section' as const, id: input.placement.sectionId }
      : { kind: 'item' as const, id: input.placement.anchorItemId }

  return templateAction(
    'addTemplateItemAction',
    target,
    async ({ payload }) => {
      const parsed = validateAction(addItemSchema, input)
      if (!parsed.success) return parsed
      const { placement, data, catalogue, translate } = parsed.data
      if (!catalogue) return { success: false, error: TEMPLATE_ITEM_NEEDS_CATALOGUE }

      const fields = catalogueRow(data)
      if (!fields.description || !fields.unit) {
        return { success: false, error: EMPTY_ITEM_TEXT_ERROR }
      }
      const existingEntry = translate
        ? await findCatalogueItemByKey(await getDb(payload), fields.matchKey)
        : undefined
      const translated = translate
        ? await translateNewRow(
            { description: fields.description, unit: fields.unit, descriptionTranslations: {} },
            new Map(
              existingEntry ? [[fields.matchKey, existingEntry.descriptionTranslations]] : [],
            ),
          )
        : { translations: {}, failed: false }
      const row = { ...fields, descriptionTranslations: translated.translations }

      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT<{ item: KosztorysItemT }>> => {
          const txDb = await getDb(payload, req)
          // Before the first write: a returned failure still commits.
          const resolved = await resolveCatalogueWrite(txDb, row.matchKey, catalogue.mode)
          if ('error' in resolved) return { success: false, error: resolved.error }

          const slot = await resolveNewTemplateItemSlot(txDb, placement)
          if ('error' in slot) return { success: false, error: slot.error }

          const catalogueItemId = await applyCatalogueWrite(payload, req, {
            candidate: row,
            existing: resolved.existing,
            keepCatalogueCategory: catalogue.keepCatalogueCategory,
            workNote: catalogue.workNote,
          })
          const item = itemFromFields(row, slot.sectionId, slot.displayOrder, catalogueItemId)
          const [id] = await insertTemplateItems(txDb, slot.sectionId, slot.displayOrder, [
            catalogueItemId,
          ])

          const warnings = [
            ...ceilingWarnings([item]),
            ...(translated.failed ? [SAVED_UNTRANSLATED_WARNING] : []),
          ]
          return {
            success: true,
            data: { item: { ...item, id } },
            ...(warnings.length > 0 && { warning: warnings.join(' ') }),
          }
        },
        { skipRevalidation: true },
      )
    },
    ['workCatalogue'],
  )
}

async function placeInTemplateSection(
  db: DbExecutorT,
  section: KosztorysSectionT,
  nextDisplayOrder: number,
  catalogueItems: readonly WorkCatalogueItemT[],
): Promise<AppendedCatalogueSliceT> {
  const items = catalogueItems.map((catalogueItem, i) =>
    itemFromFields(catalogueItem, section.id, nextDisplayOrder + i, catalogueItem.id),
  )
  const ids = await insertTemplateItems(
    db,
    section.id,
    nextDisplayOrder,
    catalogueItems.map((catalogueItem) => catalogueItem.id),
  )
  return {
    section: { ...section, items: items.map((item, i) => ({ ...item, id: ids[i] })) },
    warnings: ceilingWarnings(items),
  }
}

export async function insertCatalogueItemsIntoTemplateAction(
  sectionId: number,
  catalogueItemIds: number[],
): Promise<ActionResultT<AppendedCatalogueSliceT>> {
  return templateAction(
    'insertCatalogueItemsIntoTemplateAction',
    { kind: 'section', id: sectionId },
    async ({ payload }) => {
      const parsed = validateAction(insertCatalogueItemsSchema, { sectionId, catalogueItemIds })
      if (!parsed.success) return parsed

      const items = await readCatalogueItems(payload, parsed.data.catalogueItemIds)
      if ('error' in items) return { success: false, error: items.error }

      const created = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          const owner = await templateSectionAndNextItemOrder(txDb, parsed.data.sectionId)
          if (!owner) return undefined
          return placeInTemplateSection(txDb, owner.section, owner.nextDisplayOrder, items)
        },
        { skipRevalidation: true },
      )
      if (!created) return { success: false, error: 'Nie znaleziono sekcji' }
      return { success: true, data: created }
    },
  )
}

async function appendIntoTemplateSectionNamed(
  db: DbExecutorT,
  templateId: number,
  sectionName: string,
  catalogueItems: readonly WorkCatalogueItemT[],
): Promise<NewSectionCatalogueSliceT | undefined> {
  const existingId = await templateSectionIdByName(db, templateId, sectionName)
  if (existingId === undefined) return undefined
  const owner = await templateSectionAndNextItemOrder(db, existingId)
  if (!owner) throw new Error(`Sekcja ${existingId} zniknęła w trakcie zapisu.`)
  const slice = await placeInTemplateSection(db, owner.section, owner.nextDisplayOrder, catalogueItems)
  return { ...slice, createdSection: false }
}

// The kosztorys plane's `createSectionWithCatalogueItems`, race re-read after the shift included.
export async function createTemplateSectionWithCatalogueItemsAction(
  templateId: number,
  sectionName: string,
  catalogueItemIds: number[],
): Promise<ActionResultT<NewSectionCatalogueSliceT>> {
  return templateAction(
    'createTemplateSectionWithCatalogueItemsAction',
    { kind: 'template', id: templateId },
    async ({ payload }) => {
      const parsed = validateAction(createSectionWithCatalogueItemsSchema, {
        ownerId: templateId,
        sectionName,
        catalogueItemIds,
      })
      if (!parsed.success) return parsed

      const items = await readCatalogueItems(payload, parsed.data.catalogueItemIds)
      if ('error' in items) return { success: false, error: items.error }
      const name = parsed.data.sectionName

      const created = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          const existing = await appendIntoTemplateSectionNamed(txDb, templateId, name, items)
          if (existing) return existing
          await shiftDisplayOrderFrom(txDb, 'template-sections', templateId, 0)
          const raced = await appendIntoTemplateSectionNamed(txDb, templateId, name, items)
          if (raced) return raced

          const id = await insertTemplateSection(txDb, templateId, name, 0)
          const slice = await placeInTemplateSection(
            txDb,
            { id, name, displayOrder: 0, color: null },
            0,
            items,
          )
          return { ...slice, createdSection: true }
        },
        { skipRevalidation: true },
      )
      after(() => translateSectionName(payload, name))
      return { success: true, data: created }
    },
  )
}
