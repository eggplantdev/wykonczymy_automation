import 'server-only'
import type { Payload } from 'payload'
import { z } from 'zod'
import { getDb } from '@/lib/db/get-db'
import { listCatalogueItemsByIds } from '@/lib/db/work-catalogue'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const catalogueItemIdsSchema = z
  .array(z.number().int().positive())
  .min(1, 'Wybierz co najmniej jedną pracę')

export const insertCatalogueItemsSchema = z.object({
  sectionId: z.number().int().positive(),
  catalogueItemIds: catalogueItemIdsSchema,
})

export const createSectionWithCatalogueItemsSchema = z.object({
  ownerId: z.number().int().positive(),
  sectionName: z.string().trim().min(1, 'Podaj nazwę sekcji'),
  catalogueItemIds: catalogueItemIdsSchema,
})

// The client sends ONLY ids: every number that lands in the rozpiska is re-read from the cennik
// server-side, so a tampered payload cannot price a praca.
export async function readCatalogueItems(
  payload: Payload,
  catalogueItemIds: number[],
): Promise<WorkCatalogueItemT[] | { error: string }> {
  const db = await getDb(payload)
  // Before the existence check: `listCatalogueItemsByIds` returns one row per REQUESTED id, so
  // `[5, 5, 5]` would pass the length test and append the same praca three times.
  const ids = [...new Set(catalogueItemIds)]
  const items = await listCatalogueItemsByIds(db, ids)
  if (items.length !== ids.length)
    return { error: 'Część wybranych prac nie istnieje już w katalogu.' }
  return items
}
