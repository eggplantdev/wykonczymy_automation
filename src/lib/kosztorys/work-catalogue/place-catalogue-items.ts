import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { asViewPricing } from '@/lib/kosztorys/calc'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { insertItems } from '@/lib/kosztorys/insert-rows'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import type { KosztorysItemT, KosztorysSectionT } from '@/lib/kosztorys/types'
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

// Both sides model the stawka the same way, so a katalog „auto" (`null`) stays „auto", derived from
// this investment's global współczynnik.
const asItem = (
  catalogueItem: WorkCatalogueItemT,
  sectionId: number,
  displayOrder: number,
): KosztorysItemT => ({
  id: 0,
  sectionId,
  displayOrder,
  description: catalogueItem.description,
  unit: catalogueItem.unit,
  plannedQty: 0,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: catalogueItem.clientPrice,
  wToolsOverrideValue: catalogueItem.wToolsRate,
  ownToolsOverrideValue: catalogueItem.ownToolsRate,
  wToolsOverrideCoeff: null,
  ownToolsOverrideCoeff: null,
  note: null,
})

/**
 * Write cennik pozycje into a sekcja starting at `nextDisplayOrder`. THE CALLER OWNS THE TRANSACTION.
 *
 * Consecutive slots rather than an insert-at is what lets this write N rows at once:
 * `shiftDisplayOrderFrom` moves the tail by exactly +1, so an insert-at of N rows would silently
 * collide. Each row gets `next + i` — DISTINCT display_orders, because `insertItems` maps RETURNING
 * ids back by `(section_id, display_order)` and degrades to positional order on a tie.
 *
 * The ceiling WARNS and does not block: a katalog price the owner entered on purpose must not be
 * refused by the row it is being copied into, but he still gets told which praca crossed it.
 */
export async function placeCatalogueItems(
  db: DbExecutorT,
  placement: CataloguePlacementT,
  catalogueItems: readonly WorkCatalogueItemT[],
): Promise<AppendedCatalogueSliceT> {
  const sectionId = placement.section.id
  const items = catalogueItems.map((catalogueItem, i) =>
    asItem(catalogueItem, sectionId, placement.nextDisplayOrder + i),
  )

  // `asViewPricing` supplies zero globals, which is inert here: the guard judges a kwota stała only,
  // and a kwota never reads a współczynnik — so it needs no investment context to reach its verdict.
  const warnings = items.flatMap((item) => {
    const problems = TOOL_PLANES.flatMap(
      (plane) => checkSubcontractorPrice(asViewPricing(item), plane)?.message ?? [],
    )
    return problems.map((problem) => `„${item.description}": ${problem}`)
  })

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
