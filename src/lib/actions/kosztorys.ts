'use server'

import { z } from 'zod'
import { sql } from '@payloadcms/db-vercel-postgres'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { seedBlankKosztorys } from '@/lib/kosztorys/seed-blank'
import {
  DEFAULT_ITEM_DESCRIPTION,
  DEFAULT_UNIT,
  NEW_SECTION_DEFAULTS,
} from '@/lib/kosztorys/constants'
import type { ActionResultT } from '@/types/action'
import type { ItemPatchT } from '@/types/kosztorys'

// --- Patch schemas (all fields optional — autosave sends one field at a time) ---
// itemPatchSchema is shaped to match ItemPatchT (a single source of the type in types/kosztorys.ts).

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
    wToolsCoeff: z.coerce.number().nullable(),
    ownToolsCoeff: z.coerce.number().nullable(),
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
// value is netto PLN ('amount') or percentage points ('percent'); never negative.
const investmentGlobalDiscountSchema = z.object({
  globalDiscountType: z.enum(['percent', 'amount']).nullable(),
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
    // A global coefficient changes the derived item prices → refresh the sheet cache.
    ['kosztorysItems', 'kosztorysSections'],
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
    // vatRate is read from the investment and denormalized onto items only (getKosztorysTree),
    // so items is the sole tag needed — no kosztorysSections, unlike the coeff action which also
    // touches section-level figures.
    ['kosztorysItems'],
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
    // like vatRate — items is the sole tag needed.
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
      // Append slot = MAX(display_order)+1, not count (see addItemAction): a delete leaves a gap.
      const res = await db.execute(sql`
        SELECT COALESCE(MAX(display_order) + 1, 0) AS next
        FROM kosztorys_sections WHERE investment_id = ${investmentId}
      `)
      const displayOrder = Number(res.rows[0]?.next ?? 0)
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
      // Block: a section delete FK-cascades through its items into stage_progress, so
      // dropping a section with any populated item silently loses recorded work.
      const res = await db.execute(sql`
        SELECT 1 FROM kosztorys_items i
        WHERE i.section_id = ${sectionId}
          AND EXISTS (SELECT 1 FROM stage_progress sp WHERE sp.item_id = i.id AND sp.qty_done <> 0)
        LIMIT 1
      `)
      if (res.rows.length > 0) {
        return { success: false, error: 'Najpierw wyczyść wartości w pozycjach tej sekcji' }
      }
      // Forced pre-delete snapshot: the cascade is irrecoverable by in-session undo (S-07), so
      // capture the exact current state first, every time.
      const inv = await db.execute(
        sql`SELECT investment_id FROM kosztorys_sections WHERE id = ${sectionId}`,
      )
      const investmentId = inv.rows[0]?.investment_id
      if (investmentId != null) await captureAutoSnapshot(db, Number(investmentId), user.id)
      await payload.delete({ collection: 'kosztorys-sections', id: sectionId })
      return { success: true }
    },
    ['kosztorysSections', 'kosztorysItems'],
  )
}

export async function addItemAction(
  investmentId: number,
  sectionId: number,
): Promise<ActionResultT<{ id: number; displayOrder: number }>> {
  return protectedAction(
    'addItemAction',
    async ({ payload }) => {
      const db = await getDb(payload)
      // Append slot = MAX(display_order)+1, not count: removeItemAction leaves gaps, so a
      // count-based order collides with a surviving row after any middle delete.
      const res = await db.execute(sql`
        SELECT COALESCE(MAX(display_order) + 1, 0) AS next
        FROM kosztorys_items WHERE section_id = ${sectionId}
      `)
      const displayOrder = Number(res.rows[0]?.next ?? 0)
      const created = await payload.create({
        collection: 'kosztorys-items',
        data: {
          investment: investmentId,
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
  investmentId: number,
  sectionId: number,
  atDisplayOrder: number,
): Promise<ActionResultT<{ id: number; displayOrder: number }>> {
  return protectedAction(
    'insertItemAction',
    async ({ payload }) => {
      const parsed = validateAction(insertItemSchema, { sectionId, atDisplayOrder })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      await db.execute(sql`
        UPDATE kosztorys_items SET display_order = display_order + 1
        WHERE section_id = ${parsed.data.sectionId} AND display_order >= ${parsed.data.atDisplayOrder}
      `)
      const created = await payload.create({
        collection: 'kosztorys-items',
        data: {
          investment: investmentId,
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
      // Block: an item cascades stage_progress on delete — dropping a row that carries recorded
      // work silently loses it (mirrors removeStageAction). Recorded stage progress is the whole
      // test — it is the only per-item value a user cannot otherwise clear from the grid.
      const res = await db.execute(sql`
        SELECT investment_id FROM kosztorys_items i
        WHERE i.id = ${itemId}
          AND EXISTS (SELECT 1 FROM stage_progress sp WHERE sp.item_id = i.id AND sp.qty_done <> 0)
        LIMIT 1
      `)
      if (res.rows.length > 0) {
        return { success: false, error: 'Najpierw wyczyść wartości wpisane w tej pozycji' }
      }
      // Forced pre-delete snapshot: an allowed delete still drops the row's opis/przedmiar/cena/rabat,
      // irrecoverable by in-session undo (S-07) — capture first, exactly like removeSectionAction.
      const inv = await db.execute(
        sql`SELECT investment_id FROM kosztorys_items WHERE id = ${itemId}`,
      )
      const investmentId = inv.rows[0]?.investment_id
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
      // Block: don't drop a stage that still has recorded progress (would silently lose it).
      const res = await db.execute(sql`
        SELECT 1 FROM stage_progress WHERE stage_id = ${parsed.data.stageId} AND qty_done <> 0 LIMIT 1
      `)
      if (res.rows.length > 0) {
        return { success: false, error: 'Najpierw wyczyść ilości wpisane w tym etapie' }
      }
      // Forced pre-delete snapshot (see removeSectionAction) — only fires on a genuinely-allowed
      // delete, since the progress guard above already rejected a stage with recorded work.
      const inv = await db.execute(
        sql`SELECT investment_id FROM kosztorys_stages WHERE id = ${parsed.data.stageId}`,
      )
      const investmentId = inv.rows[0]?.investment_id
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
