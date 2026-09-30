import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { insertItems } from '@/lib/kosztorys/insert-rows'
import { itemFromFields } from '@/lib/kosztorys/item-from-fields'
import { ceilingWarnings } from '@/lib/kosztorys/subcontractor-price-guard'
import type { KosztorysSectionT } from '@/lib/kosztorys/types'
import type {
  AppendedCatalogueSliceT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

// Both callers derive this from a row rather than from the wire, so an item's investment and
// section FKs can never disagree.
export type CataloguePlacementT = {
  investmentId: number
  section: KosztorysSectionT
  nextDisplayOrder: number
}

/**
 * Write cennik pozycje into a sekcja starting at `nextDisplayOrder`. THE CALLER OWNS THE TRANSACTION.
 *
 * Consecutive slots rather than an insert-at is what lets this write N rows at once:
 * `shiftDisplayOrderFrom` moves the tail by exactly +1, so an insert-at of N rows would silently
 * collide. Each row gets `next + i` — DISTINCT display_orders, because `insertItems` maps RETURNING
 * ids back by `(section_id, display_order)` and degrades to positional order on a tie.
 */
export async function placeCatalogueItems(
  db: DbExecutorT,
  placement: CataloguePlacementT,
  catalogueItems: readonly WorkCatalogueItemT[],
): Promise<AppendedCatalogueSliceT> {
  const sectionId = placement.section.id
  const items = catalogueItems.map((catalogueItem, i) =>
    itemFromFields(catalogueItem, sectionId, placement.nextDisplayOrder + i),
  )
  const warnings = ceilingWarnings(items)

  const newIds = await insertItems(
    db,
    placement.investmentId,
    items.map((item) => ({ sectionId, item })),
  )

  return {
    section: {
      ...placement.section,
      items: items.map((item, i) => ({ ...item, id: newIds[i] })),
    },
    warnings,
  }
}
