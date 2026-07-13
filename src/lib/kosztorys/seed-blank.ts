import 'server-only'
import type { Payload } from 'payload'
import { NEW_SECTION_DEFAULTS } from '@/lib/kosztorys/v2-rows'

// Cold-start seed for a preset-less new investment: one section + one blank item, so the editor opens
// on a typable row instead of an empty grid (EX-463). Field shapes mirror addSectionAction /
// addItemAction — a fresh investment has no sections/items, so displayOrder is always 0. The caller
// owns the non-fatal try/catch and revalidation (the investment isn't cached yet, so no tag here).
export async function seedBlankKosztorys(payload: Payload, investmentId: number): Promise<void> {
  const section = await payload.create({
    collection: 'kosztorys-sections',
    data: {
      investment: investmentId,
      name: NEW_SECTION_DEFAULTS.name,
      displayOrder: 0,
      defaultCostVariant: NEW_SECTION_DEFAULTS.defaultCostVariant,
    },
  })
  await payload.create({
    collection: 'kosztorys-items',
    data: {
      investment: investmentId,
      section: section.id,
      displayOrder: 0,
      plannedQty: 0,
      measuredQty: 0,
      discountValue: 0,
      clientPrice: 0,
      hiddenInExport: false,
    },
  })
}
