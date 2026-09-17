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
import { marginV2 } from '@/lib/kosztorys/margin-v2'
import { NOTHING_DUE } from '@/lib/kosztorys/subcontractor-due'
import { ZERO_FINANCIALS } from '@/types/investment-financials'
import type { InvestmentRefT } from '@/types/reference-data'
import type { InvestmentRowT } from '@/types/table-rows'

/** The listing row assembly, kept apart from the fetches in `queries/investments.ts` so the parity
 *  audit can run the REAL row builder from a plain node script — importing it through the query
 *  module drags in `server-only` and the audit falls back to re-deriving the formula, which is how
 *  the plane defect stayed invisible in the first place. */
export function shapeInvestments(
  investments: InvestmentRefT[],
  financialsRecord: InvestmentFinancialsMapT,
  kosztorysTotalsRecord: KosztorysClientTotalsMapT,
  subcontractorDueRecord: KosztorysSubcontractorDueMapT,
  depositPlaneSumsRecord: DepositPlaneSumsMapT,
): InvestmentRowT[] {
  return investments.map((inv) => {
    const transactionFinancials = financialsRecord[String(inv.id)] ?? ZERO_FINANCIALS
    // Robocizna and rabat come from the kosztorys, full stop — no kosztorys reads as zero. Every
    // other figure here is a cash movement the kosztorys knows nothing about and stays
    // transaction-sourced.
    // The presence of the entry, held before it is flattened into figures: the aggregate returns a
    // row iff the investment has at least one kosztorys item (`kosztorys-client-totals.ts`), and
    // that fact is unrecoverable from the numbers it carries.
    const clientTotals = kosztorysTotalsRecord[String(inv.id)]
    const reading = readingFromKosztorys(clientTotals)
    const financials = financialsOnReading(transactionFinancials, reading)
    const netRate = effectiveMaterialsNetRate(inv.settlementMode, inv.materialsNetRate)
    // The two-bucket form rather than Σ of the columns: equal to the grosz, but it is the same call
    // the investment's own Podsumowanie makes, so the two surfaces cannot drift apart.
    const totalInvestmentExpense = billedMaterials(
      { grossBase: financials.materialsGrossBase, netBilled: financials.materialsNetBilled },
      netRate,
    )
    // The v2 bilans IS the panel's „Pozostało do zapłaty", negated — the same call, not a second
    // formula that agrees by convention (owner, 2026-08-20: „panel i lista mają nazywać jedną
    // kwotę"). Negated because the two read the same fact from opposite ends: the panel prints what
    // the client still owes, the bilans how the client stands, so owing shows as a minus here.
    // Not the term-by-term form `calculateBalance` still runs for v1: every term of the two agrees
    // (its materiały-minus-concession pair IS `billedMaterials`, its robocizna-plus-rabat pair IS
    // the reading's post-rabat robocizna) except the wpłaty, and that one cannot — `totalIncome`
    // counts a przelew at the brutto that moved, while the netto plane deducts the netto its faktura
    // named.
    const depositSums = depositPlaneSumsRecord[String(inv.id)] ?? NO_DEPOSIT_SUMS
    const amountDue = computeAmountDue(
      reading.laborCostsNet,
      depositPairFromPlaneSums(depositSums),
      { grossBase: financials.materialsGrossBase, netBilled: financials.materialsNetBilled },
      inv.vatRate,
      netRate,
      financials.totalLoss,
    )
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
      // Both planes, side by side, because neither is inferable from the other and an investment
      // whose kosztorys is still in a spreadsheet has its robocizna ONLY here. No brutto twin: the
      // transactions bilans has never had one.
      balanceFromTransactions: calculateBalance(transactionFinancials),
      // Only meaningful where the investment settles brutto: there every wpłata carries a brutto
      // kwota, so the deduction is complete. Elsewhere a wpłata gotówka has no brutto kwota at all
      // and this figure deducts less than was paid, which is why the listing prints „nie dotyczy"
      // outside tryb brutto rather than this number (owner, 2026-08-23). Still computed for every
      // row: the tryb is a fact the reader can flip, and the column returns with it.
      balanceGross: -amountDue.gross,
      // The count the brutto bilans above leaves out. The panel screams about the same wpłaty
      // (`SettlementPlaneWarning`); without this the listing printed the reduced figure bare and the
      // two surfaces told the reader different things (EX-724).
      strandedDeposits: strandedFromPlaneSums(depositSums, inv.settlementMode),
      // The RAW financials, not the rebased ones: this is the v1 margin and v1 IS the transactions
      // plane. Run on the kosztorys robocizna it was a third figure that matched no surface in the
      // app — same name as the investment page's, 235 908,25 zl apart from it on „11 Listopada 40".
      margin: calculateMargin(transactionFinancials),
      // No kosztorys is an answer here as much as it is for robocizna: nothing is owed to a crew for
      // work nobody entered, so the zero settlement is a fact, not a missing input.
      marginV2:
        marginV2(financials, subcontractorDueRecord[String(inv.id)] ?? NOTHING_DUE) ?? undefined,
      address: inv.address,
      phone: inv.phone,
      email: inv.email,
      contactPerson: inv.contactPerson,
      review: inv.review,
      notes: inv.notes,
      hasSheet: inv.hasSheet,
      hasKosztorys: clientTotals !== undefined,
      materialsNetRate: inv.materialsNetRate,
      settlementMode: inv.settlementMode,
      vatRate: inv.vatRate,
    }
  })
}
