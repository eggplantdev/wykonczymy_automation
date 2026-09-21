import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { asViewPricing, overrideValueFor } from '@/lib/kosztorys/calc'
import { sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import { insertItems } from '@/lib/kosztorys/insert-rows'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import type {
  AppendedCatalogueSliceT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

// Both sides model the stawka the same way, so this is a copy, not a conversion — a katalog „auto"
// (`null`) stays „auto", derived from this investment's global współczynnik.
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
  note: null,
})

/**
 * Append cennik pozycje to the END of one sekcja. THE CALLER OWNS THE TRANSACTION.
 *
 * Appending (`MAX(display_order)+1`) rather than inserting at a slot is what lets this write N rows
 * at once: `shiftDisplayOrderFrom` moves the tail by exactly +1, so an insert-at of N rows would
 * silently collide. Each row gets `next + i` — DISTINCT display_orders, because `insertItems` maps
 * RETURNING ids back by `(section_id, display_order)` and degrades to positional order on a tie.
 *
 * The ceiling WARNS and does not block: a katalog price the owner entered on purpose must not be
 * refused by the row it is being copied into, but he still gets told which praca crossed it.
 */
export async function appendCatalogueItems(
  payload: Payload,
  req: PayloadRequest,
  sectionId: number,
  catalogueItems: readonly WorkCatalogueItemT[],
): Promise<AppendedCatalogueSliceT | undefined> {
  const db = await getDb(payload, req)

  // Owner derived from the sekcja, never from the wire — an item's investment and section FKs can
  // then never disagree.
  const owner = await sectionOwnerAndNextItemOrder(db, sectionId)
  if (!owner) return undefined

  const items = catalogueItems.map((catalogueItem, i) =>
    asItem(catalogueItem, sectionId, owner.nextDisplayOrder + i),
  )

  // An „auto" plane is skipped rather than checked: there is no stawka of its own yet, and the one
  // the współczynnik will imply is checked in the rozpiska like every other derived row. Same
  // silence the guard already keeps when cena j.m. is 0.
  const warnings = items.flatMap((item) => {
    const problems = (['w_tools', 'own_tools'] as const)
      .filter((plane) => overrideValueFor(item, plane) !== null)
      // Zero globals: this filter leaves only planes frozen to a kwota, and a kwota never reads a
      // współczynnik — so the guard needs no investment context to reach its verdict.
      .flatMap((plane) => checkSubcontractorPrice(asViewPricing(item), plane)?.message ?? [])
    return problems.map((problem) => `„${item.description}": ${problem}`)
  })

  const newIds = await insertItems(
    db,
    owner.investmentId,
    items.map((item) => ({ sectionId, item })),
  )

  return {
    section: {
      ...owner.section,
      items: items.map((item, i) => ({ ...item, id: newIds[i] })),
    },
    warnings,
  }
}
