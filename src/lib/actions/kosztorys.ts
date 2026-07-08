'use server'

import { z } from 'zod'
import { protectedAction, validateAction } from '@/lib/actions/run-action'
import type { ActionResultT } from '@/types/action'
import type { ItemPatchT } from '@/types/kosztorys'

// --- Schematy patchy (wszystkie pola opcjonalne — autosave wysyła jedno pole) ---
// itemPatchSchema dopina się kształtem do ItemPatchT (jedno źródło typu w types/kosztorys.ts).

const itemPatchSchema = z
  .object({
    description: z.string().nullable(),
    unit: z.string().nullable(),
    plannedQty: z.coerce.number(),
    measuredQty: z.coerce.number(),
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

// Współczynniki narzutu inwestycji (edycja z panelu). VAT (S-12) poza zakresem.
const investmentCoeffsSchema = z
  .object({
    wToolsCoeff: z.coerce.number(),
    ownToolsCoeff: z.coerce.number(),
  })
  .partial()

export type SectionPatchT = z.infer<typeof sectionPatchSchema>
export type InvestmentCoeffsPatchT = z.infer<typeof investmentCoeffsSchema>

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
    // Współczynnik globalny zmienia wyprowadzone ceny pozycji → odśwież cache kosztorysu.
    ['kosztorysItems', 'kosztorysSections'],
  )
}

// --- Struktura: sekcje / pozycje ---

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

const reorderItemsSchema = z.object({
  sectionId: z.number(),
  orderedItemIds: z.array(z.number()).min(1),
})

// Renumeracja display_order pozycji sekcji wg pełnej listy id (nie swap dwóch) — serwer
// dostaje całą prawdę o kolejności i renumeruje od zera. Zarezerwowane pod przyszły
// cross-section move; ▲▼ używa swapItemOrderAction (2 zapisy zamiast N).
export async function reorderItemsAction(
  sectionId: number,
  orderedItemIds: number[],
): Promise<ActionResultT> {
  return protectedAction(
    'reorderItemsAction',
    async ({ payload }) => {
      const parsed = validateAction(reorderItemsSchema, { sectionId, orderedItemIds })
      if (!parsed.success) return parsed
      await Promise.all(
        parsed.data.orderedItemIds.map((id, index) =>
          payload.update({ collection: 'kosztorys-items', id, data: { displayOrder: index } }),
        ),
      )
      return { success: true }
    },
    ['kosztorysItems'],
  )
}

const itemOrderSchema = z.object({ id: z.number(), displayOrder: z.number() })
const swapItemOrderSchema = z.object({ first: itemOrderSchema, second: itemOrderSchema })

// Zamiana display_order dwóch pozycji (sąsiadów) — 2 update'y niezależnie od rozmiaru sekcji.
// Dla ruchu ▲▼ (zawsze swap sąsiadów) wystarcza to zamiast renumeracji całej sekcji.
// Każdy argument niesie NOWY display_order, który pozycja ma przyjąć.
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
