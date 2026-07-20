import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { ClientKosztorysRowT, KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// Neutral stand-ins for the subcontractor fields KosztorysV2RowT declares and the client payload
// deliberately does not carry. Nothing reads them: the client grid is built at view 'client', where
// every pricing path goes through clientPrice and none of these is touched. They exist only so the
// shared row type is satisfiable — inventing a price here would be worse than a zero, because a
// zero that leaked would be visibly meaningless rather than plausibly real.
const NO_SUBCONTRACTOR_PRICING = {
  wToolsOverrideType: null,
  wToolsOverrideValue: 0,
  ownToolsOverrideType: null,
  ownToolsOverrideValue: 0,
  costVariant: null,
  sectionDefaultCostVariant: 'w_tools',
  sectionWToolsCoeff: null,
  sectionOwnToolsCoeff: null,
  globalWToolsCoeff: 0,
  globalOwnToolsCoeff: 0,
} as const

/**
 * Adapt the client DTO into the grid's row shape at the render boundary.
 *
 * The alternative — having the DTO carry pre-computed money figures — would give the client view a
 * second source of truth for every net/brutto/pozostało cell, drifting from the editor's. Instead the
 * payload carries the same raw inputs the editor's rows do (minus the subcontractor plane) and the
 * shared column builders compute from them, at view 'client'.
 */
export function toGridRows(
  rows: ClientKosztorysRowT[],
  stages: KosztorysStageT[],
  vatRate: number,
  globalDiscountActive: boolean,
): KosztorysV2RowT[] {
  return rows.map((row, index) => {
    const stageFields: Record<string, number> = {}
    for (const stage of stages) stageFields[stageKey(stage.id)] = row.stageQty[stage.id] ?? 0
    return {
      ...NO_SUBCONTRACTOR_PRICING,
      id: row.id,
      sectionId: row.sectionId,
      sectionName: row.sectionName,
      // The payload arrives in grid order already (the projection preserves the tree's ordering), so
      // the index IS the display order — the client never reorders anything.
      displayOrder: index,
      description: row.description,
      unit: row.unit,
      plannedQty: row.plannedQty,
      clientPrice: row.clientPrice,
      discountType: row.discountType,
      discountValue: row.discountValue,
      hiddenInExport: false,
      note: row.note,
      vatRate,
      globalDiscountActive,
      ...stageFields,
    } as KosztorysV2RowT
  })
}
