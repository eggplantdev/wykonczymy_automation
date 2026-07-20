import { isGlobalDiscountActive, type PriceViewT } from '@/lib/kosztorys/calc'
import {
  clientTotalsFromSubtotals,
  sectionSubtotalsForView,
  stageTotalsForView,
} from '@/lib/kosztorys/settlement'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type {
  ClientKosztorysViewT,
  ClientKosztorysRowT,
  KosztorysTreeT,
} from '@/lib/kosztorys/types'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

// Pinned, not passed. Every money figure below is computed at this literal, so a subcontractor price
// is never derived on this path — the leak is closed structurally rather than by filtering a wider
// payload afterwards. A `view` parameter here would reopen it with one bad call site.
const CLIENT_VIEW: PriceViewT = 'client'

// The financial-plane figures the row tree cannot see (transactions live in another collection),
// so the caller reads them and hands them in.
type FinancialsT = {
  investmentName: string
  materialyNet: number
  materialyBreakdown: MaterialyBreakdownRowT[]
  wplatyNet: number
}

/**
 * Project the owner's editable tree onto the client-facing payload (S-11).
 *
 * The projection is the security boundary: it copies field-by-field onto `ClientKosztorysRowT`
 * rather than spreading the row and deleting the sensitive keys. A spread-then-omit would leak every
 * field added to `KosztorysItemT` later by default; this direction fails closed — a new field is
 * absent until someone writes it in.
 */
export function toClientView(tree: KosztorysTreeT, financials: FinancialsT): ClientKosztorysViewT {
  const allRows = treeToRows(tree)
  const subtotals = sectionSubtotalsForView(allRows, tree.stages, CLIENT_VIEW)
  const { sumaPracNet, rabatClientNet, doneNet } = clientTotalsFromSubtotals(
    subtotals,
    tree.globalDiscount,
  )
  const stageTotals = stageTotalsForView(allRows, tree.stages, CLIENT_VIEW)

  const rows: ClientKosztorysRowT[] = allRows.map((row) => {
    const stageQty: Record<number, number> = {}
    for (const stage of tree.stages) stageQty[stage.id] = row[stageKey(stage.id)] ?? 0
    return {
      id: row.id,
      sectionId: row.sectionId,
      sectionName: row.sectionName,
      description: row.description,
      unit: row.unit,
      plannedQty: row.plannedQty,
      clientPrice: row.clientPrice,
      discountType: row.discountType,
      discountValue: row.discountValue,
      note: row.note,
      stageQty,
    }
  })

  return {
    investmentName: financials.investmentName,
    vatRate: tree.vatRate,
    globalDiscountActive: isGlobalDiscountActive(tree.globalDiscount),
    stages: tree.stages,
    rows,
    sections: subtotals.map((s) => ({
      sectionId: s.sectionId,
      sectionName: s.sectionName,
      net: s.net,
      share: s.share,
    })),
    totals: {
      sumaPracNet,
      rabatNet: rabatClientNet,
      // Post-rabat executed work — what the footer bills, and what „Do zapłaty" subtracts wpłaty from.
      robociznaNet: doneNet,
      materialyNet: financials.materialyNet,
      materialyBreakdown: financials.materialyBreakdown,
      wplatyNet: financials.wplatyNet,
      stageTotals: tree.stages.map((stage) => ({
        stageId: stage.id,
        net: stageTotals.get(stage.id) ?? 0,
      })),
    },
  }
}
