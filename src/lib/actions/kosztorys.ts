'use server'

import { z } from 'zod'
import { sql } from '@payloadcms/db-vercel-postgres'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction } from '@/lib/actions/run-action'
import { KOSZTORYS_TREE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { lockStatusFor } from '@/lib/db/investment-lock'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { cleanDescription } from '@/lib/kosztorys/clean-description'
import { getItemDescriptions, setItemDescriptions } from '@/lib/db/kosztorys-descriptions'
import {
  createSectionWithFirstItem,
  type CreatedSectionWithItemT,
} from '@/lib/kosztorys/create-section'
import { createBlankItem, sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import {
  insertDirectionSchema,
  moveOrderSchema,
  moveRowOneStep,
  nextSectionDisplayOrder,
  renumberDisplayOrder,
  renumberDisplayOrderSchema,
  resolveInsertSlot,
  shiftDisplayOrderFrom,
  type InsertDirectionT,
  type MoveDirectionT,
} from '@/lib/kosztorys/display-order'
import { applyPercentDiscountSchema } from '@/lib/kosztorys/percent-discount'
import { isSectionColorKey, type SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { replaceTreeWithSnapshot } from '@/lib/kosztorys/replace-tree-with-snapshot'
import { SETTLEMENT_MODES, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { SNAPSHOT_SCHEMA_VERSION } from '@/lib/kosztorys/snapshot-format'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { ActionResultT } from '@/types/action'
import type { ItemPatchT, StagePatchT, ToolPlaneT } from '@/lib/kosztorys/types'

// Derived from TOOL_PLANES rather than re-listing the union, so a plane added to the pickers can't
// be silently rejected by validation.
const stagePlaneSchema = z.enum(TOOL_PLANES)
const SECTION_MISSING = 'Sekcja nie istnieje.'
const ITEM_MISSING = 'Pozycja nie istnieje.'

// --- Patch schemas (all fields optional — autosave sends one field at a time) ---
// itemPatchSchema is shaped to match ItemPatchT (a single source of the type in lib/kosztorys/types.ts).

const itemPatchSchema = z
  .object({
    description: z.string().nullable(),
    unit: z.string().nullable(),
    plannedQty: z.coerce.number(),
    discountType: z.enum(['percent', 'amount']).nullable(),
    // Floor only: the percent ceiling can't live here, since the same slot carries złotówki when the
    // type is 'amount' (discount-edit.ts).
    discountValue: z.coerce.number().min(0),
    clientPrice: z.coerce.number(),
    // `.nullable()` WRAPS the coercion rather than following a coerced number: `z.coerce.number()`
    // turns null into 0, which is the one value that must stay distinguishable from „auto".
    wToolsOverrideValue: z.coerce.number().nullable(),
    ownToolsOverrideValue: z.coerce.number().nullable(),
    note: z.string().nullable(),
  })
  .partial()

const sectionPatchSchema = z
  .object({
    name: z.string(),
    displayOrder: z.coerce.number().int().min(0),
    // null clears the pin (back to the pie's positional palette).
    color: z.custom<SectionColorKeyT>(isSectionColorKey).nullable(),
  })
  .partial()

// Investment markup coefficients (edited from the panel).
const investmentCoeffsSchema = z
  .object({
    wToolsCoeff: z.coerce.number(),
    ownToolsCoeff: z.coerce.number(),
  })
  .partial()

// Per-investment VAT rate, stored as a fraction (0.08 = 8%). Edited from the Sekcje panel.
// Fraction bounds: a per-investment VAT rate below 0% or above 100% is never valid, so reject it
// at the action regardless of UI guarding — a bad rate feeds every brutto figure (net × (1 + vatRate)).
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

// --- Field updates (autosave) ---

// The three per-cell autosaves below defer the refresh. The editor holds `rows` in useState seeded
// once at mount and derives every panel figure from it, so the route re-render `updateTag` triggers
// reseeds nothing the editor reads — the grid keeps its own state and the panel has already
// recomputed optimistically. The only cached reader of these tags is the client share link
// (lib/queries/preview-kosztorys.ts), a different route, and `revalidateTag` still expires it for its
// next request. Measured on preview: the discarded re-render cost 90-193ms per debounced save,
// dominated by the uncached kosztorys tree (EX-597).
export async function updateItemFieldAction(itemId: number, patch: ItemPatchT) {
  return investmentAction(
    'updateItemFieldAction',
    { kind: 'item', id: itemId },
    async ({ payload }) => {
      const parsed = validateAction(itemPatchSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'kosztorys-items', id: itemId, data: parsed.data })
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
    // Coeffs re-derive item and section figures, so bump their collection tags. 'investments'
    // also invalidates the cached readers of the mutated source row (getInvestment,
    // fetchReferenceData) immediately, rather than waiting on the investments afterChange hook.
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
    // vatRate is denormalized onto items only (not sections, unlike coeffs). 'investments' also
    // invalidates the cached readers of the mutated source row (getInvestment, fetchReferenceData)
    // immediately, rather than waiting on the investments afterChange hook.
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
    // like vatRate. 'investments' also invalidates the cached readers of the mutated source row
    // (getInvestment, fetchReferenceData) immediately, rather than waiting on the afterChange hook.
    ['kosztorysItems', 'investments'],
  )
}

// Percent rabat bulk-apply: stamps `percent X` on EVERY item of the investment's kosztorys in one
// SQL statement. A kosztorys can hold 1000+ items, so N Payload updates would be O(n) round-trips —
// raw SQL via the src/lib/db client, like the other financial bulk writes. One-shot tool, not stored
// state: the percent lands in per-item rabaty and nothing persists the percent itself.
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

// „Popraw literówki w opisie prac" — rewrites every opis in the kosztorys through one shared set of
// rules (spelling, spacing, sentence case). Bulk overwrite of hand-typed text, irrecoverable by
// in-session undo, so it snapshots first exactly like applyPercentDiscountToAllItemsAction.
export async function cleanItemDescriptionsAction(
  investmentId: number,
): Promise<ActionResultT<number>> {
  return investmentAction(
    'cleanItemDescriptionsAction',
    { investmentId },
    async ({ payload, user }) => {
      const db = await getDb(payload)
      const rows = await getItemDescriptions(db, investmentId)
      const changed = rows.flatMap((row) => {
        const description = cleanDescription(row.description)
        return description === row.description ? [] : [{ id: row.id, description }]
      })
      if (changed.length === 0) return { success: true, data: 0 }

      await captureAutoSnapshot(db, investmentId, user.id)
      return { success: true, data: await setItemDescriptions(db, investmentId, changed) }
    },
    ['kosztorysItems'],
  )
}

// --- Structure: sections / items ---

const clearKosztorysSchema = z.object({ investmentId: z.number().int().positive() })

// Goes through the same wholesale replacement as the import and the szablon reload rather than its
// own DELETE: that path already owns the investment lock and the forced labelled snapshot, which is
// the only thing making this undoable.
//
// The empty tree's `settings` are inert — `takeSettingsFromTree` is off, so restoreKosztorys writes
// back the investment's own VAT and współczynniki. The global rabat is NOT: „wyczyść" means empty,
// and an amount discount left behind would price the next import below its own total. It is the one
// figure the snapshot cannot give back — SnapshotPayloadT excludes it by design — which is why the
// dialog says so instead of promising a clean round trip.
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
        tree: {
          schemaVersion: SNAPSHOT_SCHEMA_VERSION,
          sections: [],
          items: [],
          stages: [],
          progress: [],
          settings: { wToolsCoeff: 0, ownToolsCoeff: 0, vatRate: 0 },
        },
        takeSettingsFromTree: false,
        clearGlobalDiscount: true,
      })
      return { success: true }
    },
    [...KOSZTORYS_TREE_TAGS],
  )
}

// Appends a section at the end, WITH its first blank item — see createSectionWithFirstItem for why
// the pair is one call (and one round trip for the client) rather than two actions.
export async function addSectionAction(
  investmentId: number,
): Promise<ActionResultT<CreatedSectionWithItemT>> {
  return investmentAction(
    'addSectionAction',
    { investmentId },
    async ({ payload }) => {
      const db = await getDb(payload)
      const displayOrder = await nextSectionDisplayOrder(db, investmentId)
      const created = await withPayloadTransaction(
        payload,
        (req) => createSectionWithFirstItem(payload, { investmentId, displayOrder, req }),
        { skipRevalidation: true },
      )
      return { success: true, data: created }
    },
    ['kosztorysSections', 'kosztorysItems'],
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

// Section-level twin of insertItemAction (⋯ → Wstaw sekcję powyżej/poniżej): opens the slot, then
// creates the section and its first item there — all three inside one transaction.
//
// The caller names the anchor and a direction, not a display_order: resolving the slot inside the
// transaction is what makes it correct under a concurrent insert, and it drops the investment id
// from the wire (it is the anchor's, so a caller can no longer pair the two wrong).
export async function insertSectionAction(
  anchorSectionId: number,
  dir: InsertDirectionT,
): Promise<ActionResultT<CreatedSectionWithItemT>> {
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
          return createSectionWithFirstItem(payload, {
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
    ['kosztorysSections', 'kosztorysItems'],
  )
}

// ⋯ → Przesuń sekcję w górę/dół. The neighbour is resolved inside the transaction that writes the
// swap, so the client never has to carry a copy of anybody's display_order.
export async function swapSectionOrderAction(
  sectionId: number,
  dir: MoveDirectionT,
): Promise<ActionResultT> {
  return investmentAction(
    'swapSectionOrderAction',
    { kind: 'section', id: sectionId },
    async ({ payload }) => {
      const parsed = validateAction(moveOrderSchema, { rowId: sectionId, dir })
      if (!parsed.success) return parsed
      await withPayloadTransaction(
        payload,
        async (req) => {
          // An edge row writes nothing and still succeeds — the UI disables the arrow, and a race
          // that removed the neighbour meanwhile is not an error.
          await moveRowOneStep(
            await getDb(payload, req),
            'kosztorys-sections',
            parsed.data.rowId,
            parsed.data.dir,
          )
        },
        { skipRevalidation: true },
      )
      return { success: true }
    },
    ['kosztorysSections'],
  )
}

export async function addItemAction(
  sectionId: number,
): Promise<ActionResultT<{ id: number; displayOrder: number }>> {
  return investmentAction(
    'addItemAction',
    { kind: 'section', id: sectionId },
    async ({ payload }) => {
      const db = await getDb(payload)
      const owner = await sectionOwnerAndNextItemOrder(db, sectionId)
      if (!owner) return { success: false, error: SECTION_MISSING }
      const created = await createBlankItem(payload, {
        investmentId: owner.investmentId,
        sectionId,
        displayOrder: owner.nextDisplayOrder,
      })
      return { success: true, data: created }
    },
    ['kosztorysItems'],
  )
}

const insertItemSchema = z.object({
  anchorItemId: z.number(),
  dir: insertDirectionSchema,
})

// Insert a blank item just above or below an existing one (right-click → Wstaw pozycję
// powyżej/poniżej). The anchor's section — and the slot within it — are resolved server-side, inside
// the transaction that then shifts the tail and creates the row.
export async function insertItemAction(
  anchorItemId: number,
  dir: InsertDirectionT,
): Promise<ActionResultT<{ id: number; displayOrder: number }>> {
  return investmentAction(
    'insertItemAction',
    { kind: 'item', id: anchorItemId },
    async ({ payload }) => {
      const parsed = validateAction(insertItemSchema, { anchorItemId, dir })
      if (!parsed.success) return parsed
      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT<{ id: number; displayOrder: number }>> => {
          const txDb = await getDb(payload, req)
          const slot = await resolveInsertSlot(
            txDb,
            'kosztorys-items',
            parsed.data.anchorItemId,
            parsed.data.dir,
          )
          if (!slot) return { success: false, error: ITEM_MISSING }
          // Only the investment is needed here — the slot is already resolved, so the append-position
          // aggregate `sectionOwnerAndNextItemOrder` would compute is dead weight held under the
          // section-wide lock.
          const owner = (await lockStatusFor(txDb, 'section', slot.ownerId))?.investmentId
          if (owner == null) return { success: false, error: SECTION_MISSING }
          await shiftDisplayOrderFrom(txDb, 'kosztorys-items', slot.ownerId, slot.at)
          const created = await createBlankItem(payload, {
            investmentId: owner,
            sectionId: slot.ownerId,
            displayOrder: slot.at,
            req,
          })
          return { success: true, data: created }
        },
        { skipRevalidation: true },
      )
    },
    ['kosztorysItems'],
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

// ▲▼ move within a section — the item twin of swapSectionOrderAction, neighbour and all.
export async function swapItemOrderAction(
  itemId: number,
  dir: MoveDirectionT,
): Promise<ActionResultT> {
  return investmentAction(
    'swapItemOrderAction',
    { kind: 'item', id: itemId },
    async ({ payload }) => {
      const parsed = validateAction(moveOrderSchema, { rowId: itemId, dir })
      if (!parsed.success) return parsed
      await withPayloadTransaction(
        payload,
        async (req) => {
          await moveRowOneStep(
            await getDb(payload, req),
            'kosztorys-items',
            parsed.data.rowId,
            parsed.data.dir,
          )
        },
        { skipRevalidation: true },
      )
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

const ITEMS_NOT_IN_KOSZTORYS = 'Pozycje spoza tego kosztorysu.'

// „Zapisz kolejność" (menu nagłówka kolumny) — writes the grid's current order into display_order
// across every section, in one statement so a half-applied renumber can't leave sections sharing
// indices.
//
// The client sends the ids in the order it wants them, for the WHOLE sheet; the numbering is derived
// here. That is the whole point of the sequence payload: display_order is only ever compared within a
// section, so the index has to restart per section, and that rule belongs on one side of the wire.
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
          // Reads the guard's answer and takes the bake's lock in one statement. The scope is the
          // WHOLE sheet, not just the ids sent: the guard and the bake are one decision — which ids
          // exist, and what index each one takes — so a „Wstaw pozycję" into any section has to be
          // frozen out, not only into the ones being renumbered. Otherwise the insert takes an index
          // the bake then hands to a different row, and two rows share a display_order in one section
          // with no unique constraint to catch it. Ascending id like every other acquisition in
          // display-order.ts, so it cannot cycle against them (EX-632).
          //
          // The ids come from the client and renumberDisplayOrder joins on id alone, so this read is
          // also the only thing standing between a caller and another investment's rows. It carries
          // `section_id`, which is what the per-section numbering below is grouped by. All-or-nothing:
          // one stale id (a row deleted in another tab) refuses the entire bake, and the client's
          // rollback depends on that.
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

// --- Stages (etapy) ---

// A new etap is created WITH its plane — the picker is forced at creation (the add menu offers
// „z narzędziami" / „bez narzędzi", never a plane-less „Etap"), so no new stage is ever null.
// Legacy stages keep their null and its unconfirmed warning until a human picks one.
export async function addStageAction(
  investmentId: number,
  plane: ToolPlaneT,
): Promise<ActionResultT<{ id: number; ordinal: number }>> {
  return investmentAction(
    'addStageAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(stagePatchSchema, { plane })
      if (!parsed.success) return parsed
      const existing = await payload.find({
        collection: 'kosztorys-stages',
        where: { investment: { equals: investmentId } },
        sort: '-ordinal',
        limit: 1,
        depth: 0,
      })
      const nextOrdinal = (existing.docs[0]?.ordinal ?? 0) + 1
      const created = await payload.create({
        collection: 'kosztorys-stages',
        data: { investment: investmentId, ordinal: nextOrdinal, plane },
      })
      return { success: true, data: { id: created.id, ordinal: nextOrdinal } }
    },
    ['kosztorysStages'],
  )
}

// stagePatchSchema is shaped to match StagePatchT (single source of the type in lib/kosztorys/types.ts).
const stagePatchSchema = z
  .object({
    label: z.string().nullable(),
    plane: stagePlaneSchema,
    workerId: z.number().int().positive().nullable(),
  })
  .partial()

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
      // The patch key is workerId (the tree carries flat *_id values); the collection field is the
      // `worker` relationship — translate at this boundary, nowhere else.
      const { workerId, ...rest } = parsed.data
      const data = 'workerId' in parsed.data ? { ...rest, worker: workerId } : rest
      await payload.update({ collection: 'kosztorys-stages', id: stageId, data })
      return { success: true }
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
