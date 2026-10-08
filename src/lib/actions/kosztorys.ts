'use server'

import { after } from 'next/server'
import { z } from 'zod'
import { sql } from '@payloadcms/db-vercel-postgres'
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
  resolveCatalogueWrite,
} from '@/lib/kosztorys/work-catalogue/write-catalogue-entry'
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
import { insertStageMembers, replaceStageSplit, selectStagePool } from '@/lib/db/stage-split'
import { trashedWorkerMessage } from '@/lib/db/worker-gate'
import { findCatalogueItemByKey } from '@/lib/db/work-catalogue'
import { translateNewRow } from '@/lib/ai/translate-new-row'
import { SAVED_UNTRANSLATED_WARNING } from '@/lib/utils/notice'
import { translateSectionName } from '@/lib/actions/translate-section-name'

// Derived from TOOL_PLANES so a plane added to the pickers can't be silently rejected here.
const stagePlaneSchema = z.enum(TOOL_PLANES)
const SECTION_MISSING = 'Sekcja nie istnieje.'
const ITEM_MISSING = 'Pozycja nie istnieje.'

// --- Patch schemas (all fields optional — autosave sends one field at a time) ---
// The item patch schema lives beside ItemPatchT in lib/kosztorys/item-patch-schema.ts.

const sectionPatchSchema = z
  .object({
    name: z.string(),
    displayOrder: z.coerce.number().int().min(0),
    // null clears the pin (back to the pie's positional palette).
    color: z.custom<SectionColorKeyT>(isSectionColorKey).nullable(),
  })
  .partial()

// Floor only: above 0,65 the mnożnik warns but saves (owner, 2026-09-21); below 0 is a typo.
const investmentCoeffsSchema = z
  .object({
    wToolsCoeff: z.coerce.number().min(0),
    ownToolsCoeff: z.coerce.number().min(0),
  })
  .partial()

// Per-investment VAT rate as a fraction (0.08 = 8%). Bounds rejected here regardless of UI guarding
// — a bad rate feeds every brutto figure (net × (1 + vatRate)).
const investmentVatSchema = z.object({ vatRate: z.coerce.number().min(0).max(1) })

// Derived from SETTLEMENT_MODES so a mode added to the picker can't be silently rejected here.
const investmentSettlementModeSchema = z.object({
  settlementMode: z.enum(SETTLEMENT_MODES),
})

// Materiały billed netto instead of brutto, as a fraction; null clears the concession. Same fraction
// bounds as the VAT rate and for the same reason — the rate feeds both marża and bilans.
const investmentMaterialsNetRateSchema = z.object({
  materialsNetRate: z.coerce.number().min(0).max(1).nullable(),
})

// Per-investment global discount over the whole kosztorys. type null = none (clears the discount).
// Amount-only: value is netto PLN; never negative. A percent rabat isn't stored here —
// applyPercentDiscountToAllItemsAction stamps it into each per-item rabat instead.
const investmentGlobalDiscountSchema = z.object({
  globalDiscountType: z.enum(['amount']).nullable(),
  globalDiscountValue: z.coerce.number().min(0),
})

export type SectionPatchT = z.infer<typeof sectionPatchSchema>
export type InvestmentCoeffsPatchT = z.infer<typeof investmentCoeffsSchema>
export type InvestmentGlobalDiscountPatchT = z.infer<typeof investmentGlobalDiscountSchema>

// The three per-cell autosaves below defer the refresh: the editor seeds `rows` once at mount and
// recomputes the panel optimistically, so the re-render reseeds nothing it reads. The only cached
// reader of these tags is the client share link (lib/queries/preview-kosztorys.ts), which
// `revalidateTag` still expires. The discarded re-render cost 90-193ms per debounced save (EX-597).
export async function updateItemFieldAction(itemId: number, patch: ItemPatchT) {
  return investmentAction(
    'updateItemFieldAction',
    { kind: 'item', id: itemId },
    async ({ payload }) => {
      const parsed = validateAction(itemPatchSchema, patch)
      if (!parsed.success) return parsed
      // The grid sends ONE field per call, so the pair of columns behind a stawka is made whole
      // here — one write, never two orderings (EX-865).
      const data = normalizeOverridePatch(parsed.data)
      await payload.update({ collection: 'kosztorys-items', id: itemId, data })
      return { success: true }
    },
    ['kosztorysItems'],
    { deferRefresh: true },
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
    // Coeffs re-derive item and section figures. 'investments' expires the cached readers of the
    // mutated row (getInvestment, fetchReferenceData) without waiting on its afterChange hook.
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
    // vatRate is denormalized onto items only (not sections, unlike coeffs). 'investments' expires
    // the cached readers of the mutated row without waiting on its afterChange hook.
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
    // Unlike vatRate, the mode isn't denormalized onto items — every reader projects it from the
    // tree, so invalidating the investment row is enough.
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
    // Like the settlement mode, the rate isn't denormalized onto items — it only ever reaches the
    // financial aggregates, which read the investment row.
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
    // The active flag is denormalized onto items only (getKosztorysTree → globalDiscountActive),
    // like vatRate. 'investments' expires the cached readers of the mutated row immediately.
    ['kosztorysItems', 'investments'],
  )
}

// One SQL statement because a kosztorys can hold 1000+ items and N Payload updates would be as many
// round-trips. One-shot tool: the percent lands in per-item rabaty, nothing persists the percent.
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
      // The overwrite is irrecoverable by in-session undo (owner: recovery = re-typing), and it
      // flattens whatever per-item rabaty were there — hand-tuned amounts included. Snapshot the exact
      // current state first, every time, exactly like removeSectionAction's destructive-write guard.
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

// „Popraw literówki". Bulk overwrite of hand-typed text, irrecoverable by in-session undo, so it
// snapshots first like applyPercentDiscountToAllItemsAction.
export async function cleanItemTextsAction(investmentId: number): Promise<ActionResultT<number>> {
  return investmentAction(
    'cleanItemTextsAction',
    { investmentId },
    async ({ payload, user }) => {
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

// Reuses the import's wholesale replacement rather than its own DELETE: that path already owns the
// investment lock and the forced labelled snapshot, which is the only thing making this undoable.
//
// `takeSettingsFromTree` is off, so restoreKosztorys writes back the investment's own VAT and
// współczynniki. The global rabat is cleared instead — an amount left behind would price the next
// import below its own total — and SnapshotPayloadT excludes it, so the dialog warns rather than
// promise a clean round trip.
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

// Prepends a bare section at the TOP. The shift and the create share one transaction: a double-fired
// add would otherwise land two sections on 0.
//
// One case the transaction cannot serialize: an investment with NO sections yet. `shiftDisplayOrderFrom`
// takes its lock on the rows it is pushing down, and there are none — so two concurrent first-adds
// both land on 0 and the tie falls to id. Left as is deliberately: the window is one empty kosztorys,
// the result is an order, not a corruption, and „Przenumeruj" repairs it. Locking the investment row
// to close it would put every section insert behind a lock the rest of the editor also wants.
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
      // Deleting a populated section is allowed (EX-477) — the UI gates it behind a confirm. A
      // section delete FK-cascades through its items into stage_progress, irrecoverable by in-session
      // undo (S-07), so capture the exact current state as a snapshot first, every time.
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

// Section-level twin of addItemAction's next-to placement. The caller names an anchor and a direction, not a
// display_order: resolving the slot inside the transaction is what makes it correct under a
// concurrent insert, and it drops the investment id from the wire (it is the anchor's).
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
  // The katalog's own domain schema, not a copy: the dialog's praca and a katalog entry are the same
  // fields, and `insertItems` bypasses Payload's field rules, so this is the only backstop against a
  // negative cena or both columns of one płaszczyzna set.
  data: workCatalogueItemSchema,
  catalogue: z
    .object({
      mode: z.enum(['new', 'overwrite']),
      keepCatalogueCategory: z.boolean(),
      workNote: z.string().optional(),
    })
    .nullable(),
  // „Tłumacz automatycznie przy pomocy AI" — off unless the dialog asks, so no other caller pays an AI wait.
  translate: z.boolean().optional(),
})

export type AddItemInputT = z.infer<typeof addItemSchema>

async function catalogueTranslationsFor(db: DbExecutorT, matchKey: string) {
  const entry = await findCatalogueItemByKey(db, matchKey)
  return new Map(entry ? [[matchKey, entry.descriptionTranslations]] : [])
}

const EMPTY_ITEM_TEXT_ERROR = 'Praca musi mieć opis i jednostkę miary.'

// One slot per placement, both under the transaction: an append takes MAX+1, an insert-at locks the
// anchor's position and moves the tail down by one.
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

/**
 * The katalog entry rides the praca's transaction, so a failed katalog write takes the praca down
 * with it rather than leaving half of what was asked for.
 *
 * `'workCatalogue'` is revalidated unconditionally: the collection's own hook is silenced by
 * `skipRevalidation`, and a static list cannot say „only when written" — one extra tag expiry on a
 * praca added without the katalog costs less than a branch.
 */
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
    async ({ payload, investmentId }) => {
      const parsed = validateAction(addItemSchema, input)
      if (!parsed.success) return parsed
      const { placement, data, catalogue, translate } = parsed.data

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

          // The katalog is written first so the praca can name the entry it was saved to; both ride
          // one transaction, so a failed insert still takes the katalog write down with it.
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
      // Deleting a populated item is allowed (EX-477) — the UI gates it behind a confirm. A delete
      // still drops the row's opis/przedmiar/cena/rabat (and cascades stage_progress), irrecoverable
      // by in-session undo (S-07), so capture a snapshot first, every time.
      await captureAutoSnapshot(db, investmentId, user.id)
      await payload.delete({ collection: 'kosztorys-items', id: itemId })
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

const ITEMS_NOT_IN_KOSZTORYS = 'Pozycje spoza tego kosztorysu.'

// „Zapisz kolejność". One statement, so a half-applied renumber can't leave sections sharing
// indices. The client sends ids in the order it wants them for the WHOLE sheet and the numbering is
// derived here: display_order is only ever compared within a section, so the index restarts per
// section and that rule lives on one side of the wire.
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
          // Reads the guard's answer and takes the bake's lock in one statement, over the WHOLE
          // sheet rather than the ids sent: a „Wstaw pozycję" into any section would otherwise take
          // an index the bake hands to another row, and two rows sharing a display_order in one
          // section has no unique constraint to catch it. Ascending id like every other acquisition
          // in display-order.ts, so it cannot cycle against them (EX-632).
          //
          // renumberDisplayOrder joins on id alone, so this read is also the only thing standing
          // between a caller and another investment's rows. All-or-nothing: one stale id (a row
          // deleted in another tab) refuses the entire bake, and the client's rollback depends on it.
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

// „Ustaw kolejność". Moves rows across sections as well as within them, which no ▲▼ or bake can, so
// it snapshots first: a regrouped 400-row szablon is not something to rebuild by hand.
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

// A new etap is created WITH its plane — the picker is forced at creation (the add menu offers
// „z narzędziami" / „bez narzędzi", never a plane-less „Etap"), so no new stage is ever null.
// Legacy stages keep their null and its unconfirmed warning until a human picks one.
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
          const trashedWorker = await trashedWorkerMessage(
            await getDb(payload, req),
            normalized?.members.map((member) => member.workerId) ?? [],
          )
          if (trashedWorker) return { success: false as const, error: trashedWorker }
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
            await insertStageMembers(await getDb(payload, req), [
              { stageId: created.id, split: normalized },
            ])
          }
          return { success: true as const, data: { id: created.id, ordinal: nextOrdinal } }
        },
        { skipRevalidation: true },
      )
    },
    ['kosztorysStages'],
  )
}

// stagePatchSchema is shaped to match StagePatchT (single source of the type in lib/kosztorys/types.ts).
const stagePatchSchema = z
  .object({
    label: z.string().nullable(),
    plane: stagePlaneSchema,
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

// A plane patch only ever writes a concrete value — an explicit pick confirms the plane and clears
// the unconfirmed (null) warning; there is no "un-confirm" path.
export async function updateStageAction(
  stageId: number,
  patch: StagePatchT,
): Promise<ActionResultT> {
  return investmentAction(
    'updateStageAction',
    { kind: 'stage', id: stageId },
    async ({ payload }) => {
      const parsed = validateAction(stagePatchSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'kosztorys-stages', id: stageId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysStages'],
  )
}

const STAGE_MISSING = 'Etap nie istnieje.'

// The whole split in one call: mode and members are one concept, and two patches would have states
// no single save produces (lessons.md). The cap is checked against the pool priced here, inside the
// transaction, never against the figure the dialog last saw.
export async function updateStageSplitAction(
  stageId: number,
  split: StageSplitT | null,
): Promise<ActionResultT> {
  return investmentAction(
    'updateStageSplitAction',
    { kind: 'stage', id: stageId },
    async ({ payload }) => {
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
          const trashedWorker = await trashedWorkerMessage(
            txDb,
            normalized?.members.map((member) => member.workerId) ?? [],
          )
          if (trashedWorker) return { success: false, error: trashedWorker }
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
      // Deleting a populated stage is allowed (EX-477) — the UI gates it behind a confirm. Dropping
      // the stage cascades its stage_progress, irrecoverable by in-session undo (S-07), so capture a
      // snapshot first, every time.
      await captureAutoSnapshot(db, investmentId, user.id)
      await payload.delete({ collection: 'kosztorys-stages', id: parsed.data.stageId })
      return { success: true }
    },
    ['kosztorysStages', 'stageProgress'],
  )
}

// --- Stage progress (upsert by item + stage; sparse — a missing row means 0) ---

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
    // Same deferral as the two field autosaves above — this is the etap quantity cell, the most
    // frequent write in the editor.
    { deferRefresh: true },
  )
}
