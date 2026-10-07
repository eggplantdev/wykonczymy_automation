import { unstable_cache } from 'next/cache'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import {
  findCatalogueItemByKey,
  getCatalogueSourceItem,
  listCatalogueItems,
} from '@/lib/db/work-catalogue'
import { toCatalogueCandidate } from '@/lib/kosztorys/work-catalogue/item-to-catalogue'
import type {
  CatalogueSavePreviewT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

// The whole cennik, in one argument-free cache entry — the katalog is global and a few hundred rows,
// so there is nothing to paginate or scope. Same shape as `getPresets`; invalidated by the
// collection's own hooks and by every action that writes through the `workCatalogue` tag.
export const getWorkCatalogue = unstable_cache(
  async (): Promise<WorkCatalogueItemT[]> => {
    const payload = await getPayload({ config })
    return listCatalogueItems(await getDb(payload))
  },
  ['work-catalogue-v3'],
  { tags: [CACHE_TAGS.workCatalogue] },
)

// Both „Zapisz do katalogu…" paths start here, with the numbers derived from the pozycja in the DB
// and never from the wire, so the dialog's preview and the save cannot disagree.
export async function catalogueSaveState(
  payload: Payload,
  itemId: number,
): Promise<CatalogueSavePreviewT | { error: string }> {
  const db = await getDb(payload)
  const source = await getCatalogueSourceItem(db, itemId)
  if (!source) return { error: 'Nie znaleziono pozycji' }

  const candidate = toCatalogueCandidate(source)
  const existing = await findCatalogueItemByKey(db, candidate.matchKey)
  return { candidate, existing: existing ?? null }
}
