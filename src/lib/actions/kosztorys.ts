'use server'

import { z } from 'zod'
import { sql } from '@payloadcms/db-vercel-postgres'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { nextSectionDisplayOrder } from '@/lib/kosztorys/insert-rows'
import { seedBlankKosztorys } from '@/lib/kosztorys/seed-blank'
import { applyPercentRabatSchema } from '@/lib/kosztorys/percent-rabat'
import {
  DEFAULT_ITEM_DESCRIPTION,
  DEFAULT_UNIT,
  NEW_SECTION_DEFAULTS,
} from '@/lib/kosztorys/constants'
import type { ActionResultT } from '@/types/action'
import type { ItemPatchT } from '@/lib/kosztorys/types'

// --- Patch schemas (all fields optional — autosave sends one field at a time) ---
// itemPatchSchema is shaped to match ItemPatchT (a single source of the type in lib/kosztorys/types.ts).

const itemPatchSchema = z
  .object({
    description: z.string().nullable(),
    unit: z.string().nullable(),
    plannedQty: z.coerce.number(),
    discountType: z.enum(['percent', 'amount']).nullable(),
    discountValue: z.coerce.number(),
    clientPrice: z.coerce.number(),
    wToolsOverrideType: z.enum(['coeff', 'amount']).nullable(),
    wToolsOverrideValue: z.coerce.number(),
    ownToolsOverrideType: z.enum(['coeff', 'amount']).nullable(),
    ownToolsOverrideValue: z.coerce.number(),
    costVariant: z.enum(['w_tools', 'own_tools']).nullable(),
    hiddenInExport: z.boolean(),
    note: z.string().nullable(),
  })
  .partial()

const sectionPatchSchema = z
  .object({
    name: z.string(),
    defaultCostVariant: z.enum(['w_tools', 'own_tools']),
    displayOrder: z.coerce.number(),
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

// Per-investment global discount over the whole kosztorys. type null = none (clears the discount).
// Amount-only: value is netto PLN; never negative. A percent global rabat is no longer stored —
// applyPercentRabatToAllItemsAction stamps it into each per-item rabat instead.
const investmentGlobalDiscountSchema = z.object({
  globalDiscountType: z.enum(['amount']).nullable(),
  globalDiscountValue: z.coerce.number().min(0),
})

export type SectionPatchT = z.infer<typeof sectionPatchSchema>
export type InvestmentCoeffsPatchT = z.infer<typeof investmentCoeffsSchema>
export type InvestmentGlobalDiscountPatchT = z.infer<typeof investmentGlobalDiscountSchema>

// --- Field updates (autosave) ---

export async function updateItemFieldAction(itemId: number, patch: ItemPatchT) {
  return protectedAction(
    'updateItemFieldAction',
    async ({ payload }) => {
      const parsed = validateAction(itemPatchSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'kosztorys-items', id: itemId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

export async function updateSectionFieldAction(sectionId: number, patch: SectionPatchT) {
  return protectedAction(
    'updateSectionFieldAction',
    async ({ payload }) => {
      const parsed = validateAction(sectionPatchSchema, patch)
      if (!parsed.success) return parsed
      await payload.update({ collection: 'kosztorys-sections', id: sectionId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysSections'],
  )
}

export async function updateInvestmentCoeffsAction(
  investmentId: number,
  patch: InvestmentCoeffsPatchT,
) {
  return protectedAction(
    'updateInvestmentCoeffsAction',
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
  return protectedAction(
    'updateInvestmentVatAction',
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

export async function updateInvestmentGlobalDiscountAction(
  investmentId: number,
  patch: InvestmentGlobalDiscountPatchT,
) {
  return protectedAction(
    'updateInvestmentGlobalDiscountAction',
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
export async function applyPercentRabatToAllItemsAction(
  investmentId: number,
  percent: number,
): Promise<ActionResultT> {
  return protectedAction(
    'applyPercentRabatToAllItemsAction',
    async ({ payload }) => {
      const parsed = validateAction(applyPercentRabatSchema, { percent })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
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

// --- Structure: sections / items ---

export async function addSectionAction(
  investmentId: number,
): Promise<ActionResultT<{ id: number; displayOrder: number }>> {
  return protectedAction(
    'addSectionAction',
    async ({ payload }) => {
      const db = await getDb(payload)
      const displayOrder = await nextSectionDisplayOrder(db, investmentId)
      const created = await payload.create({
        collection: 'kosztorys-sections',
        data: {
          investment: investmentId,
          name: NEW_SECTION_DEFAULTS.name,
          displayOrder,
          defaultCostVariant: NEW_SECTION_DEFAULTS.defaultCostVariant,
        },
      })
      return { success: true, data: { id: created.id, displayOrder } }
    },
    ['kosztorysSections'],
  )
}

// Cold-start unblock for an empty kosztorys: create one named section + one blank item (a 0-item
// section renders as 0 rows). Shares seedBlankKosztorys with the EX-463 new-investment auto-seed.
export async function seedBlankSectionAction(
  investmentId: number,
  name?: string,
): Promise<ActionResultT<Record<string, never>>> {
  return protectedAction(
    'seedBlankSectionAction',
    async ({ payload }) => {
      // Idempotency guard: the client only opens the seeding dialog on an empty kosztorys, but a
      // double-submit / stale tab could reach here after a section exists — seeding again would add
      // a duplicate section at display_order 0. Bail as a no-op.
      const existing = await payload.count({
        collection: 'kosztorys-sections',
        where: { investment: { equals: investmentId } },
      })
      if (existing.totalDocs > 0) return { success: true, data: {} }
      await seedBlankKosztorys(payload, investmentId, name?.trim() || undefined)
      return { success: true, data: {} }
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}

export async function removeSectionAction(sectionId: number) {
  return protectedAction(
    'removeSectionAction',
    async ({ payload, user }) => {
      const db = await getDb(payload)
      // Deleting a populated section is allowed (EX-477) — the UI gates it behind a confirm. A
      // section delete FK-cascades through its items into stage_progress, irrecoverable by in-session
      // undo (S-07), so capture the exact current state as a snapshot first, every time.
      const res = await db.execute(sql`
        SELECT investment_id FROM kosztorys_sections WHERE id = ${sectionId}
      `)
      const investmentId = res.rows[0]?.investment_id
      if (investmentId != null) await captureAutoSnapshot(db, Number(investmentId), user.id)
      await payload.delete({ collection: 'kosztorys-sections', id: sectionId })
      return { success: true }
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}

export async function addItemAction(
  sectionId: number,
): Promise<ActionResultT<{ id: number; displayOrder: number }>> {
  return protectedAction(
    'addItemAction',
    async ({ payload }) => {
      const db = await getDb(payload)
      // Append slot = MAX(display_order)+1, not count: removeItemAction leaves gaps, so a
      // count-based order collides with a surviving row after any middle delete. The section is the
      // single source of investment ownership — derive it here rather than trust a caller-passed id,
      // so the item's investment and section FKs can never disagree.
      const res = await db.execute(sql`
        SELECT s.investment_id AS investment, COALESCE(MAX(i.display_order) + 1, 0) AS next
        FROM kosztorys_sections s
        LEFT JOIN kosztorys_items i ON i.section_id = s.id
        WHERE s.id = ${sectionId}
        GROUP BY s.investment_id
      `)
      const section = res.rows[0]
      if (!section) return { success: false, error: 'Sekcja nie istnieje.' }
      const displayOrder = Number(section.next ?? 0)
      const created = await payload.create({
        collection: 'kosztorys-items',
        data: {
          investment: Number(section.investment),
          section: sectionId,
          displayOrder,
          description: DEFAULT_ITEM_DESCRIPTION,
          unit: DEFAULT_UNIT,
          plannedQty: 0,
          discountValue: 0,
          clientPrice: 0,
          hiddenInExport: false,
        },
      })
      return { success: true, data: { id: created.id, displayOrder } }
    },
    ['kosztorysItems'],
  )
}

const insertItemSchema = z.object({
  sectionId: z.number(),
  atDisplayOrder: z.coerce.number().int().min(0),
})

// Insert a blank item at a specific display_order within a section (right-click → Wstaw pozycję
// powyżej/poniżej). Shifts the section's tail down by one to open the slot, then creates the row
// there. The shift is bounded by SECTION size — the whole-sheet concern that made ▲▼ reorder a
// neighbor-swap (1000+ rows) doesn't apply to one section. A create failure after the shift only
// leaves a harmless gap in display_order (order is relative); addItemAction (append) is unchanged.
export async function insertItemAction(
  sectionId: number,
  atDisplayOrder: number,
): Promise<ActionResultT<{ id: number; displayOrder: number }>> {
  return protectedAction(
    'insertItemAction',
    async ({ payload }) => {
      const parsed = validateAction(insertItemSchema, { sectionId, atDisplayOrder })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      // Derive investment from the section (single source of ownership), so the item's investment
      // and section FKs can never disagree — see addItemAction.
      const owner = await db.execute(sql`
        SELECT investment_id FROM kosztorys_sections WHERE id = ${parsed.data.sectionId}
      `)
      const investmentId = owner.rows[0]?.investment_id
      if (investmentId == null) return { success: false, error: 'Sekcja nie istnieje.' }
      // Shift + create must be atomic: a double-fired insert at the same index could otherwise
      // interleave and land two rows on one display_order (EX-464).
      const created = await withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          await txDb.execute(sql`
          UPDATE kosztorys_items SET display_order = display_order + 1
          WHERE section_id = ${parsed.data.sectionId} AND display_order >= ${parsed.data.atDisplayOrder}
        `)
          return payload.create({
            collection: 'kosztorys-items',
            req,
            data: {
              investment: Number(investmentId),
              section: parsed.data.sectionId,
              displayOrder: parsed.data.atDisplayOrder,
              description: DEFAULT_ITEM_DESCRIPTION,
              unit: DEFAULT_UNIT,
              plannedQty: 0,
              discountValue: 0,
              clientPrice: 0,
              hiddenInExport: false,
            },
          })
        },
        { skipRevalidation: true },
      )
      return { success: true, data: { id: created.id, displayOrder: parsed.data.atDisplayOrder } }
    },
    ['kosztorysItems'],
  )
}

export async function removeItemAction(itemId: number) {
  return protectedAction(
    'removeItemAction',
    async ({ payload, user }) => {
      const db = await getDb(payload)
      // Deleting a populated item is allowed (EX-477) — the UI gates it behind a confirm. A delete
      // still drops the row's opis/przedmiar/cena/rabat (and cascades stage_progress), irrecoverable
      // by in-session undo (S-07), so capture a snapshot first, every time.
      const res = await db.execute(sql`
        SELECT investment_id FROM kosztorys_items WHERE id = ${itemId}
      `)
      const investmentId = res.rows[0]?.investment_id
      if (investmentId != null) await captureAutoSnapshot(db, Number(investmentId), user.id)
      await payload.delete({ collection: 'kosztorys-items', id: itemId })
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

const itemOrderSchema = z.object({ id: z.number(), displayOrder: z.number() })
const swapItemOrderSchema = z.object({ first: itemOrderSchema, second: itemOrderSchema })

// Swaps the display_order of two (adjacent) items — 2 updates regardless of section size.
// For the ▲▼ move (always a swap of neighbors) this suffices instead of renumbering the whole section.
// Each argument carries the NEW display_order that the item should take on.
export async function swapItemOrderAction(
  first: { id: number; displayOrder: number },
  second: { id: number; displayOrder: number },
): Promise<ActionResultT> {
  return protectedAction(
    'swapItemOrderAction',
    async ({ payload }) => {
      const parsed = validateAction(swapItemOrderSchema, { first, second })
      if (!parsed.success) return parsed
      await Promise.all([
        payload.update({
          collection: 'kosztorys-items',
          id: parsed.data.first.id,
          data: { displayOrder: parsed.data.first.displayOrder },
        }),
        payload.update({
          collection: 'kosztorys-items',
          id: parsed.data.second.id,
          data: { displayOrder: parsed.data.second.displayOrder },
        }),
      ])
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

// --- Stages (etapy) ---

export async function addStageAction(
  investmentId: number,
): Promise<ActionResultT<{ id: number; ordinal: number }>> {
  return protectedAction(
    'addStageAction',
    async ({ payload }) => {
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
        data: { investment: investmentId, ordinal: nextOrdinal },
      })
      return { success: true, data: { id: created.id, ordinal: nextOrdinal } }
    },
    ['kosztorysStages'],
  )
}

const stageLabelSchema = z.object({ label: z.string().nullable() })

export async function updateStageFieldAction(
  stageId: number,
  label: string | null,
): Promise<ActionResultT> {
  return protectedAction(
    'updateStageFieldAction',
    async ({ payload }) => {
      const parsed = validateAction(stageLabelSchema, { label })
      if (!parsed.success) return parsed
      await payload.update({ collection: 'kosztorys-stages', id: stageId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysStages'],
  )
}

const stageIdSchema = z.object({ stageId: z.number() })

export async function removeStageAction(stageId: number): Promise<ActionResultT> {
  return protectedAction(
    'removeStageAction',
    async ({ payload, user }) => {
      const parsed = validateAction(stageIdSchema, { stageId })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      // Deleting a populated stage is allowed (EX-477) — the UI gates it behind a confirm. Dropping
      // the stage cascades its stage_progress, irrecoverable by in-session undo (S-07), so capture a
      // snapshot first, every time.
      const res = await db.execute(sql`
        SELECT investment_id FROM kosztorys_stages WHERE id = ${parsed.data.stageId}
      `)
      const investmentId = res.rows[0]?.investment_id
      if (investmentId != null) await captureAutoSnapshot(db, Number(investmentId), user.id)
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
  return protectedAction(
    'setStageProgressAction',
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
  )
}
