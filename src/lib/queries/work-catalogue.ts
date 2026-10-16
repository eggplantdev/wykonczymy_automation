import { cached } from '@/lib/cache/cached'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { listTemplateNamesUsingCatalogueItem } from '@/lib/db/presets'
import {
  findCatalogueItemByKey,
  findLinkedCatalogueItem,
  getCatalogueSourceItem,
  listCatalogueItems,
} from '@/lib/db/work-catalogue'
import { toCatalogueCandidate } from '@/lib/kosztorys/work-catalogue/item-to-catalogue'
import type {
  CatalogueSavePreviewT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

export const getWorkCatalogue = cached(
  async (): Promise<WorkCatalogueItemT[]> => {
    const payload = await getPayload({ config })
    return listCatalogueItems(await getDb(payload))
  },
  ['work-catalogue'],
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
  const linked = await findLinkedCatalogueItem(db, itemId)
  // Matched by the remembered entry first, so a praca renamed in the katalog is still updated in
  // place; the klucz decides only for a pozycja that remembers none, or whose opis has moved on.
  const existing =
    linked?.matchKey === candidate.matchKey
      ? linked
      : ((await findCatalogueItemByKey(db, candidate.matchKey)) ?? null)
  const leaving = linked && linked.id !== existing?.id ? linked : null
  const templateNames = existing ? await listTemplateNamesUsingCatalogueItem(db, existing.id) : []
  return { candidate, existing, leaving, templateNames }
}
