import { globalDiscountAmount } from '@/lib/kosztorys/calc'
import { sectionSubtotalsForView } from '@/lib/kosztorys/settlement-aggregates'
import type {
  GlobalDiscountT,
  KosztorysStageT,
  KosztorysV2RowT,
  SectionSubtotalT,
} from '@/lib/kosztorys/types'

export type KosztorysClientTotalsT = {
  doneNet: number
  // „Suma prac wykonanych" at client prices, PRE-rabat — the executed value before any discount, so
  // it lines up with Σ LABOR_COST (a pre-rabat billing figure; rabat is a separate transfer).
  laborCostsNetFromKosztorys: number
  discountNetFromKosztorys: number
  // robocizna is `doneNet − this`, and the per-item rabat is already inside `doneNet`, so subtracting
  // the whole `discountNetFromKosztorys` would take it twice.
  globalDiscountNet: number
}

// robocizna is a client-billing figure, so the price-view toggle must never move it.
export function kosztorysClientTotals(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  globalDiscount: GlobalDiscountT,
): KosztorysClientTotalsT {
  return clientTotalsFromSubtotals(sectionSubtotalsForView(rows, stages, 'client'), globalDiscount)
}

export function clientTotalsFromSubtotals(
  clientSubtotals: SectionSubtotalT[],
  globalDiscount: GlobalDiscountT,
): KosztorysClientTotalsT {
  const doneNet = clientSubtotals.reduce((sum, s) => sum + s.net, 0)
  const itemDiscountNet = clientSubtotals.reduce((sum, s) => sum + s.discount, 0)
  const globalDiscountNet = globalDiscountAmount(doneNet, globalDiscount)
  return {
    doneNet,
    laborCostsNetFromKosztorys: doneNet + itemDiscountNet,
    discountNetFromKosztorys: globalDiscountNet + itemDiscountNet,
    globalDiscountNet,
  }
}

export function sumSectionSubtotalsNet(subtotals: SectionSubtotalT[]): number {
  return subtotals.reduce((sum, s) => sum + s.net + s.discount, 0)
}
