'use server'

import { sql } from '@payloadcms/db-postgres'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { getItemTexts, setItemTexts } from '@/lib/db/kosztorys-item-texts'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { addItemSchema, type AddItemInputT } from '@/lib/kosztorys/add-item-schema'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { cleanItemTexts } from '@/lib/kosztorys/clean-item-texts'
import { sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import {
  numberWithinSections,
  renumberDisplayOrder,
  renumberDisplayOrderSchema,
} from '@/lib/kosztorys/display-order'
import { insertItems } from '@/lib/kosztorys/insert-rows'
import { itemFromFields } from '@/lib/kosztorys/item-from-fields'
import { itemPatchSchema } from '@/lib/kosztorys/item-patch-schema'
import { addedItemResult, prepareNewItemRow } from '@/lib/kosztorys/new-item-row'
import { resolveNewItemSlot } from '@/lib/kosztorys/new-item-slot'
import { normalizeOverridePatch } from '@/lib/kosztorys/override-patch'
import { applyPercentDiscountSchema } from '@/lib/kosztorys/percent-discount'
import type { ItemPatchT, KosztorysItemT } from '@/lib/kosztorys/types'
import {
  applyCatalogueWrite,
  resolveCatalogueWrite,
} from '@/lib/kosztorys/work-catalogue/write-catalogue-entry'
import type { ActionResultT } from '@/types/action'

export type { AddItemInputT } from '@/lib/kosztorys/add-item-schema'

export async function updateItemFieldAction(itemId: number, patch: ItemPatchT) {
  return investmentAction(
    'updateItemFieldAction',
    { kind: 'item', id: itemId },
    async ({ payload }) => {
      const parsed = validateAction(itemPatchSchema, patch)
      if (!parsed.success) return parsed
      // The grid sends ONE field per call, so the pair of columns behind a stawka is made whole here.
      const data = normalizeOverridePatch(parsed.data)
      await payload.update({ collection: 'kosztorys-items', id: itemId, data })
      return { success: true }
    },
    ['kosztorysItems', 'workCatalogue'],
    { deferRefresh: true },
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

      const prepared = await prepareNewItemRow(payload, data, translate)
      if ('error' in prepared) return prepared
      const { row, translationFailed } = prepared

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

          const slot = await resolveNewItemSlot(
            txDb,
            'kosztorys-items',
            placement,
            sectionOwnerAndNextItemOrder,
          )
          if ('error' in slot) return { success: false, error: slot.error }

          const catalogueItemId = catalogueWrite
            ? await applyCatalogueWrite(payload, req, catalogueWrite)
            : null
          const item = itemFromFields(row, slot.sectionId, slot.displayOrder, catalogueItemId)
          const [id] = await insertItems(txDb, investmentId, [{ sectionId: slot.sectionId, item }])
          return addedItemResult(item, id, translationFailed)
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
          await renumberDisplayOrder(
            txDb,
            'kosztorys-items',
            numberWithinSections(parsed.data, sectionById),
          )
          return { success: true }
        },
        { skipRevalidation: true },
      )
    },
    ['kosztorysItems'],
  )
}
