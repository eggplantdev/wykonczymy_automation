import type {
  DepositPlaneSumsMapT,
  InvestmentFinancialsMapT,
  KosztorysClientTotalsMapT,
  KosztorysSubcontractorDueMapT,
} from '@/lib/queries/balances'
import { calculateBalance } from '@/lib/db/calculate-balance'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { depositPairFromPlaneSums, NO_DEPOSIT_SUMS } from '@/lib/kosztorys/deposit-planes'
import { strandedFromPlaneSums } from '@/lib/kosztorys/off-plane-deposits'
import { effectiveMaterialsNetRate } from '@/lib/kosztorys/settlement-mode'
import { financialsOnReading, readingFromKosztorys } from '@/lib/kosztorys/summary-reading'
import { billedMaterials, computeAmountDue } from '@/lib/kosztorys/summary-economics'
import { marginV2, subcontractorRemaining } from '@/lib/kosztorys/margin-v2'
import { NOTHING_DUE } from '@/lib/kosztorys/subcontractor-due'
import { ZERO_FINANCIALS } from '@/types/investment-financials'
import type { InvestmentWithNotesT } from '@/types/reference-data'
import type { InvestmentRowT } from '@/types/table-rows'

/** kept apart from the fetches in `queries/investments.ts` so the parity audit can run the REAL row
 *  builder from a plain node script — importing it through the query module drags in `server-only` */
export function shapeInvestments(
  investments: InvestmentWithNotesT[],
  financialsRecord: InvestmentFinancialsMapT,
  kosztorysTotalsRecord: KosztorysClientTotalsMapT,
  subcontractorDueRecord: KosztorysSubcontractorDueMapT,
  depositPlaneSumsRecord: DepositPlaneSumsMapT,
): InvestmentRowT[] {
  return investments.map((inv) => {
    const transactionFinancials = financialsRecord[String(inv.id)] ?? ZERO_FINANCIALS
    const clientTotals = kosztorysTotalsRecord[String(inv.id)]
    const reading = readingFromKosztorys(clientTotals)
    const financials = financialsOnReading(transactionFinancials, reading)
    const netRate = effectiveMaterialsNetRate(inv.settlementMode, inv.materialsNetRate)
    const totalInvestmentExpense = billedMaterials(
      { grossBase: financials.materialsGrossBase, netBilled: financials.materialsNetBilled },
      netRate,
    )
    // The v2 bilans IS the panel's „Pozostało do zapłaty", negated
    const depositSums = depositPlaneSumsRecord[String(inv.id)] ?? NO_DEPOSIT_SUMS
    const amountDue = computeAmountDue(
      reading.laborCostsNet,
      depositPairFromPlaneSums(depositSums),
      { grossBase: financials.materialsGrossBase, netBilled: financials.materialsNetBilled },
      inv.vatRate,
      netRate,
      financials.totalLoss,
    )
    const settlement = subcontractorDueRecord[String(inv.id)] ?? NOTHING_DUE
    return {
      id: inv.id,
      name: inv.name,
      status: inv.status,
      totalMaterialCosts: financials.totalMaterialCosts,
      totalIncome: financials.totalIncome,
      totalLaborCosts: financials.totalLaborCosts,
      totalLaborCostsFromTransactions: transactionFinancials.totalLaborCosts,
      totalPayouts: financials.totalPayouts,
      totalInvestmentExpense,
      totalSettled: financials.totalSettled,
      balance: -amountDue.net,
      balanceFromTransactions: calculateBalance(transactionFinancials),
      // Only meaningful where the investment settles brutto: Elsewhere a wpłata gotówka has no
      // brutto kwota at all and this figure deducts less than was paid
      balanceGross: -amountDue.gross,
      strandedDeposits: strandedFromPlaneSums(depositSums, inv.settlementMode),
      // The RAW financials: this is the v1 margin and v1 IS the transactions plane.
      margin: calculateMargin(transactionFinancials),
      marginV2: marginV2(financials, settlement) ?? undefined,
      subcontractorRemaining:
        clientTotals === undefined || settlement.hasUnconfirmedPlane
          ? undefined
          : subcontractorRemaining(financials, settlement),
      address: inv.address,
      phone: inv.phone,
      email: inv.email,
      contactPerson: inv.contactPerson,
      reviewRequested: inv.reviewRequested,
      notes: inv.notes,
      hasSheet: inv.hasSheet,
      createdAt: inv.createdAt,
      hasKosztorys: clientTotals !== undefined,
      aiProgress: inv.aiStage ?? 'none',
      settlementMode: inv.settlementMode,
      vatRate: inv.vatRate,
    }
  })
}
