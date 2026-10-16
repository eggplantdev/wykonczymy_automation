import type { InvestmentFinancialsT } from '@/types/investment-financials'
import type { SubcontractorSettlementT } from '@/lib/kosztorys/subcontractor-due'
import { roundToCents } from '@/lib/utils/round-to-cents'

/**
 * An etap holding executed work with no settlement plane contributes nothing to `due` while its
 * robocizna still counts, so the figure would read high by an unknown amount.
 */
export function marginV2(
  financials: InvestmentFinancialsT,
  subcontractor: SubcontractorSettlementT,
): number | null {
  if (subcontractor.hasUnconfirmedPlane) return null
  return roundToCents(
    financials.totalLaborCosts -
      financials.totalDiscount -
      subcontractor.due -
      financials.totalSettled -
      financials.totalLoss -
      financials.totalBonus,
  )
}

// Rounded before any caller reads its sign: paying out exactly the displayed amount leaves ~1e-13
// behind and would paint a settled crew red as „Nadpłata 0,00".
export function subcontractorRemaining(
  financials: InvestmentFinancialsT,
  subcontractor: SubcontractorSettlementT,
): number {
  return roundToCents(subcontractor.due + financials.totalBonus - financials.totalPayouts)
}
