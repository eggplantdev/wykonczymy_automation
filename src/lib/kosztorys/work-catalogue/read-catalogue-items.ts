import 'server-only'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { listCatalogueItemsByIds } from '@/lib/db/work-catalogue'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

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
