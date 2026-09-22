import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import { placeCatalogueItems } from '@/lib/kosztorys/work-catalogue/place-catalogue-items'
import type {
  AppendedCatalogueSliceT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

/**
 * Append cennik pozycje to the END of one existing sekcja. THE CALLER OWNS THE TRANSACTION.
 */
export async function appendCatalogueItems(
  payload: Payload,
  req: PayloadRequest,
  sectionId: number,
  catalogueItems: readonly WorkCatalogueItemT[],
): Promise<AppendedCatalogueSliceT | undefined> {
  const db = await getDb(payload, req)

  const owner = await sectionOwnerAndNextItemOrder(db, sectionId)
  if (!owner) return undefined

  return placeCatalogueItems(db, owner, catalogueItems)
}
