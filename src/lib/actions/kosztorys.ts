'use server'

import { after } from 'next/server'
import { z } from 'zod'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction } from '@/lib/actions/run-action'
import { KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { cleanItemTexts } from '@/lib/kosztorys/clean-item-texts'
import { itemPatchSchema } from '@/lib/kosztorys/item-patch-schema'
import { getItemTexts, setItemTexts } from '@/lib/db/kosztorys-item-texts'
import { applyLayout, lockAndCheckLayout } from '@/lib/db/kosztorys-layout'
import { createSection, type CreatedSectionT } from '@/lib/kosztorys/create-section'
import { sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import { insertItems } from '@/lib/kosztorys/insert-rows'
import { itemFromFields } from '@/lib/kosztorys/item-from-fields'
import {
  kosztorysLayoutSchema,
  LAYOUT_STALE,
  type KosztorysLayoutT,
} from '@/lib/kosztorys/reorder-layout'
import { ceilingWarnings } from '@/lib/kosztorys/subcontractor-price-guard'
import {
  applyCatalogueWrite,
  catalogueRow,
  DUPLICATE_ERROR,
  resolveCatalogueWrite,
} from '@/lib/kosztorys/work-catalogue/write-catalogue-entry'
import {
  catalogueUpdateFor,
  EMPTY_ITEM_TEXT_ERROR,
  splitTemplatePatch,
} from '@/lib/kosztorys/work-catalogue/template-catalogue-patch'
import { workCatalogueItemSchema } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import {
  insertDirectionSchema,
  renumberDisplayOrder,
  renumberDisplayOrderSchema,
  resolveInsertSlot,
  shiftDisplayOrderFrom,
  type InsertDirectionT,
} from '@/lib/kosztorys/display-order'
import { normalizeOverridePatch } from '@/lib/kosztorys/override-patch'
import { applyPercentDiscountSchema } from '@/lib/kosztorys/percent-discount'
import { isSectionColorKey, type SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'
import { SETTLEMENT_MODES, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { emptySnapshotPayload } from '@/lib/kosztorys/snapshot-format'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { ActionResultT } from '@/types/action'
import type {
  ItemPatchT,
  KosztorysItemT,
  NewItemPlacementT,
  StagePatchT,
  StageSplitT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import {
  normalizeStageSplit,
  STAGE_SPLIT_NEEDS_PLANE,
  validateStageSplit,
} from '@/lib/kosztorys/stage-split'
import {
  insertStageMembers,
  replaceStageSplit,
  selectStagePool,
  selectStageWorkerIds,
} from '@/lib/db/stage-split'
import { selectOtherPlaneWorkerNames, trashedWorkerMessage } from '@/lib/db/worker-gate'
import { mixedPlaneWorkersMessage } from '@/lib/constants/worker-lock'
import { findCatalogueItemByKey, findLinkedCatalogueItem } from '@/lib/db/work-catalogue'
import { translateNewRow } from '@/lib/ai/translate-new-row'
import { SAVED_UNTRANSLATED_WARNING } from '@/lib/utils/notice'
import { translateSectionName } from '@/lib/actions/translate-section-name'

const stagePlaneSchema = z.enum(TOOL_PLANES)
const SECTION_MISSING = 'Sekcja nie istnieje.'
const ITEM_MISSING = 'Pozycja nie istnieje.'

const sectionPatchSchema = z
  .object({
    name: z.string(),
    displayOrder: z.coerce.number().int().min(0),
    color: z.custom<SectionColorKeyT>(isSectionColorKey).nullable(),
  })
  .partial()

// Floor only: above 0,65 the mnożnik warns but saves.
const investmentCoeffsSchema = z
  .object({
    wToolsCoeff: z.coerce.number().min(0),
    ownToolsCoeff: z.coerce.number().min(0),
  })
  .partial()

const investmentVatSchema = z.object({ vatRate: z.coerce.number().min(0).max(1) })

const investmentSettlementModeSchema = z.object({
  settlementMode: z.enum(SETTLEMENT_MODES),
})

const investmentMaterialsNetRateSchema = z.object({
  materialsNetRate: z.coerce.number().min(0).max(1).nullable(),
})

// A percent rabat isn't stored here —
// applyPercentDiscountToAllItemsAction stamps it into each per-item rabat instead.
const investmentGlobalDiscountSchema = z.object({
  globalDiscountType: z.enum(['amount']).nullable(),
  globalDiscountValue: z.coerce.number().min(0),
})

export type SectionPatchT = z.infer<typeof sectionPatchSchema>
export type InvestmentCoeffsPatchT = z.infer<typeof investmentCoeffsSchema>
export type InvestmentGlobalDiscountPatchT = z.infer<typeof investmentGlobalDiscountSchema>

export async function updateItemFieldAction(itemId: number, patch: ItemPatchT) {
  return investmentAction(
    'updateItemFieldAction',
    { kind: 'item', id: itemId },
    async ({ payload, isTemplate }) => {
      const parsed = validateAction(itemPatchSchema, patch)
      if (!parsed.success) return parsed
      // The grid sends ONE field per call, so the pair of columns behind a stawka is made whole
      // here.
      const data = normalizeOverridePatch(parsed.data)
      const templateResult = isTemplate
        ? await updateLinkedTemplateRow(payload, itemId, data)
        : null
      if (templateResult) return templateResult
      await payload.update({ collection: 'kosztorys-items', id: itemId, data })
      return { success: true }
    },
    ['kosztorysItems', 'workCatalogue'],
    { deferRefresh: true },
  )
}

async function updateLinkedTemplateRow(
  payload: Payload,
  itemId: number,
  patch: ItemPatchT,
): Promise<ActionResultT | null> {
  const { cataloguePatch, rowPatch } = splitTemplatePatch(patch)
  if (Object.keys(cataloguePatch).length === 0) return null
  return withPayloadTransaction(
    payload,
    async (req): Promise<ActionResultT | null> => {
      const txDb = await getDb(payload, req)
      const entry = await findLinkedCatalogueItem(txDb, itemId)
      if (!entry) return null
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
      if (Object.keys(rowPatch).length > 0) {
        await payload.update({ collection: 'kosztorys-items', id: itemId, data: rowPatch, req })
      }
      return { success: true }
    },
    { skipRevalidation: true },
  )
}

export async function updateSectionFieldAction(sectionId: number, patch: SectionPatchT) {
  return investmentAction(
    'updateSectionFieldAction',
    { kind: 'section', id: sectionId },
    async ({ payload }) => {
      const parsed = validateAction(sectionPatchSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'kosztorys-sections', id: sectionId, data: parsed.data })
      const { name } = parsed.data
      if (name !== undefined) after(() => translateSectionName(payload, name))
      return { success: true }
    },
    ['kosztorysSections'],
    { deferRefresh: true },
  )
}

export async function updateInvestmentCoeffsAction(
  investmentId: number,
  patch: InvestmentCoeffsPatchT,
) {
  return investmentAction(
    'updateInvestmentCoeffsAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(investmentCoeffsSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'investments', id: investmentId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysItems', 'kosztorysSections', 'investments'],
  )
}

export async function updateInvestmentVatAction(investmentId: number, vatRate: number) {
  return investmentAction(
    'updateInvestmentVatAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(investmentVatSchema, { vatRate })
      if (!parsed.success) return parsed
      await payload.update({ collection: 'investments', id: investmentId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysItems', 'investments'],
  )
}

export async function updateInvestmentSettlementModeAction(
  investmentId: number,
  settlementMode: SettlementModeT,
) {
  return investmentAction(
    'updateInvestmentSettlementModeAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(investmentSettlementModeSchema, { settlementMode })
      if (!parsed.success) return parsed
      await payload.update({ collection: 'investments', id: investmentId, data: parsed.data })
      return { success: true }
    },
    ['investments'],
  )
}

export async function updateInvestmentMaterialsNetRateAction(
  investmentId: number,
  materialsNetRate: number | null,
) {
  return investmentAction(
    'updateInvestmentMaterialsNetRateAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(investmentMaterialsNetRateSchema, { materialsNetRate })
      if (!parsed.success) return parsed
      await payload.update({ collection: 'investments', id: investmentId, data: parsed.data })
      return { success: true }
    },
    ['investments'],
  )
}

export async function updateInvestmentGlobalDiscountAction(
  investmentId: number,
  patch: InvestmentGlobalDiscountPatchT,
) {
  return investmentAction(
    'updateInvestmentGlobalDiscountAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(investmentGlobalDiscountSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'investments', id: investmentId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysItems', 'investments'],
  )
}

// One SQL statement because a kosztorys can hold 1000+ items and N Payload updates would be as many
// round-trips.
export async function applyPercentDiscountToAllItemsAction(
  investmentId: number,
  percent: number,
): Promise<ActionResultT> {
  return investmentAction(
    'applyPercentDiscountToAllItemsAction',
    { investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(applyPercentDiscountSchema, { percent })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      await captureAutoSnapshot(db, investmentId, user.id)
      await db.execute(sql`
        UPDATE kosztorys_items
        SET discount_type = 'percent', discount_value = ${parsed.data.percent}, updated_at = now()
        WHERE investment_id = ${investmentId}
      `)
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

const TEMPLATE_TEXTS_IN_CATALOGUE = 'Opisy prac szablonu poprawia się w katalogu prac.'

export async function cleanItemTextsAction(investmentId: number): Promise<ActionResultT<number>> {
  return investmentAction(
    'cleanItemTextsAction',
    { investmentId },
    async ({ payload, user, isTemplate }) => {
      if (isTemplate) return { success: false, error: TEMPLATE_TEXTS_IN_CATALOGUE }
      const db = await getDb(payload)
      const changed = cleanItemTexts(await getItemTexts(db, investmentId))
      if (changed.length === 0) return { success: true, data: 0 }

      await captureAutoSnapshot(db, investmentId, user.id)
      return { success: true, data: await setItemTexts(db, investmentId, changed) }
    },
    ['kosztorysItems'],
  )
}

const clearKosztorysSchema = z.object({ investmentId: z.number().int().positive() })

// The global rabat is cleared — an amount left behind would price the next
// import below its own total.
export async function clearKosztorysAction(investmentId: number): Promise<ActionResultT> {
  return investmentAction(
    'clearKosztorysAction',
    { investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(clearKosztorysSchema, { investmentId })
      if (!parsed.success) return parsed

      await replaceTreeWithSnapshot(payload, {
        investmentId: parsed.data.investmentId,
        label: 'Przed wyczyszczeniem',
        takenBy: user.id,
        tree: emptySnapshotPayload({ wToolsCoeff: 0, ownToolsCoeff: 0, vatRate: 0 }),
        takeSettingsFromTree: false,
        clearGlobalDiscount: true,
      })
      return { success: true }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}

export async function addSectionAction(
  investmentId: number,
): Promise<ActionResultT<CreatedSectionT>> {
  return investmentAction(
    'addSectionAction',
    { investmentId },
    async ({ payload }) => {
      const created = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          await shiftDisplayOrderFrom(txDb, 'kosztorys-sections', investmentId, 0)
          return createSection(payload, { investmentId, displayOrder: 0, req })
        },
        { skipRevalidation: true },
      )
      return { success: true, data: created }
    },
    ['kosztorysSections'],
  )
}

export async function removeSectionAction(sectionId: number) {
  return investmentAction(
    'removeSectionAction',
    { kind: 'section', id: sectionId },
    async ({ payload, user, investmentId }) => {
      const db = await getDb(payload)
      await captureAutoSnapshot(db, investmentId, user.id)
      await payload.delete({ collection: 'kosztorys-sections', id: sectionId })
      return { success: true }
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}

const insertSectionSchema = z.object({
  anchorSectionId: z.number(),
  dir: insertDirectionSchema,
})

export async function insertSectionAction(
  anchorSectionId: number,
  dir: InsertDirectionT,
): Promise<ActionResultT<CreatedSectionT>> {
  return investmentAction(
    'insertSectionAction',
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
            'kosztorys-sections',
            parsed.data.anchorSectionId,
            parsed.data.dir,
          )
          if (!slot) return null
          await shiftDisplayOrderFrom(txDb, 'kosztorys-sections', slot.ownerId, slot.at)
          return createSection(payload, {
            investmentId: slot.ownerId,
            displayOrder: slot.at,
            req,
          })
        },
        { skipRevalidation: true },
      )
      if (!created) return { success: false, error: SECTION_MISSING }
      return { success: true, data: created }
    },
    ['kosztorysSections'],
  )
}

const newItemPlacementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('end'), sectionId: z.number().int() }),
  z.object({
    kind: z.literal('next-to'),
    anchorItemId: z.number().int(),
    dir: insertDirectionSchema,
  }),
])

const addItemSchema = z.object({
  placement: newItemPlacementSchema,
  // `insertItems` bypasses Payload's field rules, so this is the only backstop against a
  // negative cena or both columns of one płaszczyzna set.
  data: workCatalogueItemSchema,
  catalogue: z
    .object({
      mode: z.enum(['new', 'overwrite']),
      keepCatalogueCategory: z.boolean(),
      workNote: z.string().optional(),
    })
    .nullable(),
  translate: z.boolean().optional(),
})

export type AddItemInputT = z.infer<typeof addItemSchema>

const TEMPLATE_ITEM_NEEDS_CATALOGUE = 'Praca w szablonie musi być w katalogu prac.'

async function catalogueTranslationsFor(db: DbExecutorT, matchKey: string) {
  const entry = await findCatalogueItemByKey(db, matchKey)
  return new Map(entry ? [[matchKey, entry.descriptionTranslations]] : [])
}

async function resolveNewItemSlot(
  db: DbExecutorT,
  placement: NewItemPlacementT,
): Promise<{ sectionId: number; displayOrder: number } | { error: string }> {
  if (placement.kind === 'end') {
    const owner = await sectionOwnerAndNextItemOrder(db, placement.sectionId)
    if (!owner) return { error: SECTION_MISSING }
    return { sectionId: placement.sectionId, displayOrder: owner.nextDisplayOrder }
  }
  const slot = await resolveInsertSlot(db, 'kosztorys-items', placement.anchorItemId, placement.dir)
  if (!slot) return { error: ITEM_MISSING }
  await shiftDisplayOrderFrom(db, 'kosztorys-items', slot.ownerId, slot.at)
  return { sectionId: slot.ownerId, displayOrder: slot.at }
}

export async function addItemAction(
  input: AddItemInputT,
): Promise<ActionResultT<{ item: KosztorysItemT }>> {
  const target =
    input.placement.kind === 'end'
      ? { kind: 'section' as const, id: input.placement.sectionId }
      : { kind: 'item' as const, id: input.placement.anchorItemId }

  return investmentAction(
    'addItemAction',
    target,
    async ({ payload, investmentId, isTemplate }) => {
      const parsed = validateAction(addItemSchema, input)
      if (!parsed.success) return parsed
      const { placement, data, catalogue, translate } = parsed.data
      if (isTemplate && !catalogue) return { success: false, error: TEMPLATE_ITEM_NEEDS_CATALOGUE }

      const fields = catalogueRow(data)
      if (!fields.description || !fields.unit) {
        return { success: false, error: EMPTY_ITEM_TEXT_ERROR }
      }
      const translated = translate
        ? await translateNewRow(
            { description: fields.description, unit: fields.unit, descriptionTranslations: {} },
            await catalogueTranslationsFor(await getDb(payload), fields.matchKey),
          )
        : { translations: {}, failed: false }
      const row = { ...fields, descriptionTranslations: translated.translations }

      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT<{ item: KosztorysItemT }>> => {
          const txDb = await getDb(payload, req)

          // Before the first write: a returned failure still commits, so a refusal found after the
          // insert would leave the praca in without the katalog entry the owner asked for.
          let catalogueWrite: Parameters<typeof applyCatalogueWrite>[2] | null = null
          if (catalogue) {
            const resolved = await resolveCatalogueWrite(txDb, row.matchKey, catalogue.mode)
            if ('error' in resolved) return { success: false, error: resolved.error }
            catalogueWrite = {
              candidate: row,
              existing: resolved.existing,
              keepCatalogueCategory: catalogue.keepCatalogueCategory,
              workNote: catalogue.workNote,
            }
          }

          const slot = await resolveNewItemSlot(txDb, placement)
          if ('error' in slot) return { success: false, error: slot.error }

          const catalogueItemId = catalogueWrite
            ? await applyCatalogueWrite(payload, req, catalogueWrite)
            : null
          const item = itemFromFields(row, slot.sectionId, slot.displayOrder, catalogueItemId)
          const [id] = await insertItems(txDb, investmentId, [{ sectionId: slot.sectionId, item }])

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
    ['kosztorysItems', 'workCatalogue'],
  )
}

export async function removeItemAction(itemId: number) {
  return investmentAction(
    'removeItemAction',
    { kind: 'item', id: itemId },
    async ({ payload, user, investmentId }) => {
      const db = await getDb(payload)
      await captureAutoSnapshot(db, investmentId, user.id)
      await payload.delete({ collection: 'kosztorys-items', id: itemId })
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

const ITEMS_NOT_IN_KOSZTORYS = 'Pozycje spoza tego kosztorysu.'

export async function renumberKosztorysOrderAction(
  investmentId: number,
  orderedItemIds: number[],
): Promise<ActionResultT> {
  return investmentAction(
    'renumberKosztorysOrderAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(renumberDisplayOrderSchema, orderedItemIds)
      if (!parsed.success) return parsed
      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const txDb = await getDb(payload, req)
          // renumberDisplayOrder joins on id alone, so this read is also the only thing standing
          // between a caller and another investment's rows.
          const res = await txDb.execute(sql`
            SELECT id, section_id FROM kosztorys_items
            WHERE investment_id = ${investmentId}
            ORDER BY id FOR UPDATE
          `)
          const sectionById = new Map(
            res.rows.map((row) => [Number(row.id), Number(row.section_id)]),
          )
          if (parsed.data.some((id) => !sectionById.has(id))) {
            return { success: false, error: ITEMS_NOT_IN_KOSZTORYS }
          }
          const nextIndex = new Map<number, number>()
          const refs = parsed.data.map((id) => {
            const sectionId = sectionById.get(id) as number
            const index = nextIndex.get(sectionId) ?? 0
            nextIndex.set(sectionId, index + 1)
            return { id, displayOrder: index }
          })
          await renumberDisplayOrder(txDb, 'kosztorys-items', refs)
          return { success: true }
        },
        { skipRevalidation: true },
      )
    },
    ['kosztorysItems'],
  )
}

export async function writeKosztorysLayoutAction(
  investmentId: number,
  layout: KosztorysLayoutT,
): Promise<ActionResultT> {
  return investmentAction(
    'writeKosztorysLayoutAction',
    { investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(kosztorysLayoutSchema, layout)
      if (!parsed.success) return parsed
      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const tx = await getDb(payload, req)
          if (!(await lockAndCheckLayout(tx, investmentId, parsed.data))) {
            return { success: false, error: LAYOUT_STALE, code: 'NOT_FOUND' }
          }
          await captureAutoSnapshot(tx, investmentId, user.id, req)
          await applyLayout(tx, investmentId, parsed.data)
          return { success: true }
        },
        { skipRevalidation: true },
      )
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}

export async function addStageAction(
  investmentId: number,
  plane: ToolPlaneT,
  split: StageSplitT | null = null,
): Promise<ActionResultT<{ id: number; ordinal: number }>> {
  return investmentAction(
    'addStageAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(stagePatchSchema, { plane })
      if (!parsed.success) return parsed
      const parsedSplit = validateAction(stageSplitSchema, split)
      if (!parsedSplit.success) return parsedSplit
      const normalized = normalizeStageSplit(parsedSplit.data)
      // A new etap has no executed work, so only a 0 zł amount could pass the cap; the copied
      // percentages are what carries over.
      const refusal = parsedSplit.data && normalized && validateStageSplit(parsedSplit.data, 0)
      if (refusal) return { success: false, error: refusal }
      return withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          const workerIds = normalized?.members.map((member) => member.workerId) ?? []
          const trashedWorker = await trashedWorkerMessage(txDb, workerIds)
          if (trashedWorker) return { success: false as const, error: trashedWorker }
          const mixed = await selectOtherPlaneWorkerNames(txDb, { investmentId, plane, workerIds })
          if (mixed.length > 0) {
            return { success: false as const, error: mixedPlaneWorkersMessage(mixed) }
          }
          const existing = await payload.find({
            collection: 'kosztorys-stages',
            where: { investment: { equals: investmentId } },
            sort: '-ordinal',
            limit: 1,
            depth: 0,
            req,
          })
          const nextOrdinal = (existing.docs[0]?.ordinal ?? 0) + 1
          const created = await payload.create({
            collection: 'kosztorys-stages',
            data: {
              investment: investmentId,
              ordinal: nextOrdinal,
              plane,
              splitMode: normalized?.mode ?? 'percent',
            },
            req,
          })
          if (normalized) {
            await insertStageMembers(txDb, [{ stageId: created.id, split: normalized }])
          }
          return { success: true as const, data: { id: created.id, ordinal: nextOrdinal } }
        },
        { skipRevalidation: true },
      )
    },
    ['kosztorysStages'],
  )
}

const stagePatchSchema = z
  .object({
    label: z.string().nullable(),
    plane: stagePlaneSchema,
    completed: z.boolean(),
  })
  .partial()

const stageSplitSchema = z
  .object({
    mode: z.enum(['percent', 'amount']),
    members: z.array(
      z.object({
        workerId: z.number().int().positive(),
        value: z.number(),
        takesRest: z.boolean(),
      }),
    ),
  })
  .nullable()

export async function updateStageAction(
  stageId: number,
  patch: StagePatchT,
): Promise<ActionResultT> {
  return investmentAction(
    'updateStageAction',
    { kind: 'stage', id: stageId },
    async ({ payload, investmentId }) => {
      const parsed = validateAction(stagePatchSchema, patch)
      if (!parsed.success) return parsed
      const { plane } = parsed.data
      if (plane) {
        const db = await getDb(payload)
        const mixed = await selectOtherPlaneWorkerNames(db, {
          investmentId,
          plane,
          workerIds: await selectStageWorkerIds(db, stageId),
          exceptStageId: stageId,
        })
        if (mixed.length > 0) return { success: false, error: mixedPlaneWorkersMessage(mixed) }
      }
      await payload.update({ collection: 'kosztorys-stages', id: stageId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysStages'],
  )
}

const STAGE_MISSING = 'Etap nie istnieje.'

export async function updateStageSplitAction(
  stageId: number,
  split: StageSplitT | null,
): Promise<ActionResultT> {
  return investmentAction(
    'updateStageSplitAction',
    { kind: 'stage', id: stageId },
    async ({ payload, investmentId }) => {
      const parsed = validateAction(stageSplitSchema, split)
      if (!parsed.success) return parsed
      // Validated as sent, written normalized: normalizing repairs a missing rest holder by zeroing
      // the first member's amount, which would move money instead of refusing the save.
      const normalized = normalizeStageSplit(parsed.data)
      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const txDb = await getDb(payload, req)
          const res = await txDb.execute(sql`
            SELECT plane FROM kosztorys_stages WHERE id = ${stageId} FOR UPDATE
          `)
          const stage = res.rows[0]
          // Deleted between the gate and the lock: the code makes the editor reseed its tree.
          if (!stage) return { success: false, error: STAGE_MISSING, code: 'NOT_FOUND' }
          if (parsed.data && normalized) {
            if (stage.plane == null) return { success: false, error: STAGE_SPLIT_NEEDS_PLANE }
            const refusal = validateStageSplit(parsed.data, await selectStagePool(txDb, stageId))
            if (refusal) return { success: false, error: refusal }
          }
          const workerIds = normalized?.members.map((member) => member.workerId) ?? []
          const trashedWorker = await trashedWorkerMessage(txDb, workerIds)
          if (trashedWorker) return { success: false, error: trashedWorker }
          const mixed = await selectOtherPlaneWorkerNames(txDb, {
            investmentId,
            plane: stage.plane as ToolPlaneT | null,
            workerIds,
            exceptStageId: stageId,
          })
          if (mixed.length > 0) return { success: false, error: mixedPlaneWorkersMessage(mixed) }
          await replaceStageSplit(txDb, stageId, normalized)
          return { success: true }
        },
        { skipRevalidation: true },
      )
    },
    ['kosztorysStages'],
  )
}

const stageIdSchema = z.object({ stageId: z.number() })

export async function removeStageAction(stageId: number): Promise<ActionResultT> {
  return investmentAction(
    'removeStageAction',
    { kind: 'stage', id: stageId },
    async ({ payload, user, investmentId }) => {
      const parsed = validateAction(stageIdSchema, { stageId })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      await captureAutoSnapshot(db, investmentId, user.id)
      await payload.delete({ collection: 'kosztorys-stages', id: parsed.data.stageId })
      return { success: true }
    },
    ['kosztorysStages', 'stageProgress'],
  )
}

const stageProgressSchema = z.object({
  itemId: z.number(),
  stageId: z.number(),
  qtyDone: z.coerce.number(),
})

export async function setStageProgressAction(
  itemId: number,
  stageId: number,
  qtyDone: number,
): Promise<ActionResultT> {
  return investmentAction(
    'setStageProgressAction',
    { kind: 'item', id: itemId },
    async ({ payload }) => {
      const parsed = validateAction(stageProgressSchema, { itemId, stageId, qtyDone })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      await db.execute(sql`
        INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
        VALUES (${parsed.data.itemId}, ${parsed.data.stageId}, ${parsed.data.qtyDone}, now(), now())
        ON CONFLICT (item_id, stage_id)
        DO UPDATE SET qty_done = ${parsed.data.qtyDone}, updated_at = now()
      `)
      return { success: true }
    },
    ['stageProgress'],
    { deferRefresh: true },
  )
}
