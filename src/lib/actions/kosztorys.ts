'use server'

import { z } from 'zod'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/sum-transfers'
import { protectedAction, validateAction, type ActionResultT } from '@/lib/actions/utils'

// --- Schematy patchy (wszystkie pola opcjonalne — autosave wysyła jedno pole) ---

const itemPatchSchema = z
  .object({
    description: z.string().nullable(),
    unit: z.string().nullable(),
    plannedQty: z.coerce.number(),
    measuredQty: z.coerce.number(),
    discountType: z.enum(['percent', 'amount']).nullable(),
    discountValue: z.coerce.number(),
    clientPrice: z.coerce.number(),
    subcontractorWToolsPrice: z.coerce.number(),
    subcontractorOwnToolsPrice: z.coerce.number(),
    costVariant: z.enum(['w_tools', 'own_tools']).nullable(),
    vatRate: z.coerce.number().nullable(),
    hiddenInExport: z.boolean(),
    note: z.string().nullable(),
  })
  .partial()

const sectionPatchSchema = z
  .object({
    name: z.string(),
    vatRate: z.coerce.number(),
    defaultCostVariant: z.enum(['w_tools', 'own_tools']),
    displayOrder: z.coerce.number(),
  })
  .partial()

const stagePatchSchema = z.object({ label: z.string().nullable() }).partial()

export type ItemPatchT = z.infer<typeof itemPatchSchema>
export type SectionPatchT = z.infer<typeof sectionPatchSchema>

// --- Aktualizacje pól (autosave) ---

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

export async function updateStageFieldAction(stageId: number, label: string | null) {
  return protectedAction(
    'updateStageFieldAction',
    async ({ payload }) => {
      const parsed = validateAction(stagePatchSchema, { label })
      if (!parsed.success) return parsed
      await payload.update({ collection: 'kosztorys-stages', id: stageId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysStages'],
  )
}

// --- Postęp etapu (upsert po item+stage) ---

export async function setStageProgressAction(itemId: number, stageId: number, qtyDone: number) {
  return protectedAction(
    'setStageProgressAction',
    async ({ payload }) => {
      const db = await getDb(payload)
      await db.execute(sql`
        INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
        VALUES (${itemId}, ${stageId}, ${qtyDone}, now(), now())
        ON CONFLICT (item_id, stage_id)
        DO UPDATE SET qty_done = ${qtyDone}, updated_at = now()
      `)
      return { success: true }
    },
    ['stageProgress'],
  )
}

// --- Struktura: sekcje / pozycje / etapy ---

export async function addSectionAction(
  investmentId: number,
): Promise<ActionResultT<{ id: number; displayOrder: number }>> {
  return protectedAction(
    'addSectionAction',
    async ({ payload }) => {
      const count = await payload.count({
        collection: 'kosztorys-sections',
        where: { investment: { equals: investmentId } },
      })
      const created = await payload.create({
        collection: 'kosztorys-sections',
        data: {
          investment: investmentId,
          name: 'Nowa sekcja',
          displayOrder: count.totalDocs,
          vatRate: 0.08,
          defaultCostVariant: 'w_tools',
        },
      })
      return { success: true, data: { id: created.id, displayOrder: count.totalDocs } }
    },
    ['kosztorysSections'],
  )
}

export async function removeSectionAction(sectionId: number) {
  return protectedAction(
    'removeSectionAction',
    async ({ payload }) => {
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
      const count = await payload.count({
        collection: 'kosztorys-items',
        where: { section: { equals: sectionId } },
      })
      const created = await payload.create({
        collection: 'kosztorys-items',
        data: {
          investment: investmentId,
          section: sectionId,
          displayOrder: count.totalDocs,
          plannedQty: 0,
          measuredQty: 0,
          discountValue: 0,
          clientPrice: 0,
          subcontractorWToolsPrice: 0,
          subcontractorOwnToolsPrice: 0,
          hiddenInExport: false,
        },
      })
      return { success: true, data: { id: created.id, displayOrder: count.totalDocs } }
    },
    ['kosztorysItems'],
  )
}

export async function removeItemAction(itemId: number) {
  return protectedAction(
    'removeItemAction',
    async ({ payload }) => {
      await payload.delete({ collection: 'kosztorys-items', id: itemId })
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

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

export async function removeStageAction(stageId: number): Promise<ActionResultT> {
  return protectedAction(
    'removeStageAction',
    async ({ payload }) => {
      const db = await getDb(payload)
      // Blokada: nie kasuj etapu z wpisanym postępem.
      const res = await db.execute(sql`
        SELECT 1 FROM stage_progress WHERE stage_id = ${stageId} AND qty_done <> 0 LIMIT 1
      `)
      if (res.rows.length > 0) {
        return { success: false, error: 'Najpierw wyczyść ilości wpisane w tym etapie' }
      }
      await payload.delete({ collection: 'kosztorys-stages', id: stageId })
      return { success: true }
    },
    ['kosztorysStages', 'stageProgress'],
  )
}
