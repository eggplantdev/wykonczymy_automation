import type { KosztorysClientTotalsT } from '@/lib/kosztorys/settlement-client-totals'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

/**
 * `laborCostsNet` is POST-rabat and `discountAmount` rides alongside it. Both readings must land on
 * that same axis or the „Struktura kosztów" pie and the waterfall disagree between them.
 */
export type SummaryReadingT = {
  laborCostsNet: number
  discountAmount: number
}

export function readingFromTransactions(financials: InvestmentFinancialsT): SummaryReadingT {
  return {
    laborCostsNet: financials.totalLaborCosts - financials.totalDiscount,
    discountAmount: financials.totalDiscount,
  }
}

export function readingFromKosztorys(
  clientTotals: KosztorysClientTotalsT | null | undefined,
): SummaryReadingT {
  const discountAmount = clientTotals?.discountNetFromKosztorys ?? 0
  return {
    laborCostsNet: (clientTotals?.laborCostsNetFromKosztorys ?? 0) - discountAmount,
    discountAmount,
  }
}

/**
 * `totalLaborCosts` is the PRE-rabat figure on both planes, which is why the reading's post-rabat
 * robocizna gets its rabat added back here.
 */
export function financialsOnReading(
  financials: InvestmentFinancialsT,
  reading: SummaryReadingT,
): InvestmentFinancialsT {
  return {
    ...financials,
    totalLaborCosts: reading.laborCostsNet + reading.discountAmount,
    totalDiscount: reading.discountAmount,
  }
}
