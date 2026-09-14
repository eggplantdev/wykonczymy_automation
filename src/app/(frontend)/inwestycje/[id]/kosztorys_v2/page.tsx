import { notFound } from 'next/navigation'
import { parseInvestmentId } from '@/lib/queries/investment-id'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import {
  fetchPayoutTransactionsForInvestment,
  fetchDepositTransactionsForInvestment,
  fetchMaterialTransactionsForInvestment,
} from '@/lib/queries/investment-transactions'
import {
  deriveWholeInvestmentFinancials,
  fetchWholeInvestmentFinancials,
} from '@/lib/queries/whole-investment-financials'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { KosztorysEditorV2 } from '@/components/kosztorys/editor/kosztorys-editor-v2'
import { perfStart } from '@/lib/perf'
import { isLockedStatus } from '@/lib/constants/investment-lock'

// The in-app kosztorys editor ("kosztorys_v2"). Always available — every investment has one,
// the editor renders its own empty state. The legacy Google Sheet lives at /kosztorys.
export default async function InvestmentKosztorysV2Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const elapsed = perfStart()
  const { id } = await params
  const investmentId = parseInvestmentId(id)
  // Both awaits sit before the fan-out for one reason: getKosztorysTree throws — for a failed
  // session AND for a missing investment — so anything folded into the Promise.all beside it is
  // racing that throw for the right to decide what the user sees. The guard would lose the login
  // page to an error screen; the existence check would lose the 404 page outright, since the tree
  // rejects before a check placed after the fan-out can run at all.
  const user = await requireManagementPage()
  const refData = await fetchReferenceData()
  // Name, existence and the linked-sheet flag all ride along on reference data — a dedicated
  // findByID bought none of the three. Its one cost: a tag marks this entry stale but still serves
  // it once, so an investment created seconds ago 404s until the next request.
  const investment = refData.investments.find((i) => i.id === investmentId)
  if (!investment) notFound()

  const treePromise = getKosztorysTree(investmentId)
  // Read-only bridge to the financial plane: the investment's live material spend (unsettled
  // INVESTMENT_EXPENSE + CORRECTION) plus its per-expense-category split, summed via the same
  // cached path the detail page uses.
  const financialsPromise = fetchWholeInvestmentFinancials(investmentId)
  const payoutTxPromise = fetchPayoutTransactionsForInvestment(investmentId)
  const depositTxPromise = fetchDepositTransactionsForInvestment(investmentId)
  // The individual materiały rows for the Podsumowanie's wydatki list — same fetch the client share
  // read uses, so both surfaces label and split the rows identically.
  const materialTxPromise = fetchMaterialTransactionsForInvestment(investmentId)
  const [tree, financialsSource, payoutTransactions, depositTransactions, materialTransactions] =
    await Promise.all([
      treePromise,
      financialsPromise,
      payoutTxPromise,
      depositTxPromise,
      materialTxPromise,
    ])
  console.log(
    `[PERF] kosztorys_v2/${investmentId} 5-fetch fan-out ${elapsed()}ms ` +
      `(tree + financials source + 3 transaction lists)`,
  )
  const { financials, materialsBreakdown, settledBreakdown } = deriveWholeInvestmentFinancials(
    financialsSource,
    tree,
    refData.expenseCategories,
  )
  return (
    <KosztorysEditorV2
      investmentId={investmentId}
      tree={tree}
      investmentName={investment.name}
      materialsGrossBase={financials.materialsGrossBase}
      materialsNetBilled={financials.materialsNetBilled}
      materialsBreakdown={materialsBreakdown}
      settledBreakdown={settledBreakdown}
      financials={isAdminOrOwnerRole(user.role) ? financials : undefined}
      // Transaction-sourced robocizna/rabat (Σ LABOR_COST / Σ RABAT) for the in-editor reconciliation
      // scream — compared against the kosztorys figures during the population/verification transition.
      laborCostsNetFromTransactions={financials.totalLaborCosts}
      discountNetFromTransactions={financials.totalDiscount}
      investmentLoss={financials.totalLoss}
      payoutTransactions={payoutTransactions}
      depositTransactions={depositTransactions}
      materialTransactions={materialTransactions}
      workers={refData.workers}
      hasSheet={investment.hasSheet}
      locked={isLockedStatus(investment.status)}
    />
  )
}
