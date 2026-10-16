import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { perfStart } from '@/lib/perf'
import { fetchDepositTransactionsForInvestment } from '@/lib/queries/investment-transactions'
import {
  deriveWholeInvestmentFinancials,
  fetchWholeInvestmentFinancials,
} from '@/lib/queries/whole-investment-financials'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { kosztorysClientTotals } from '@/lib/kosztorys/settlement-client-totals'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import { readingFromKosztorys } from '@/lib/kosztorys/summary-reading'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import type { ExpenseCategoryRefT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  investmentName: string
  // Gates whether `financials` crosses into the client component at all — the
  // „Marża" tab's figures must stay out of a MANAGER's RSC payload, not merely off their screen.
  canSeeMargin: boolean
  expenseCategories: ExpenseCategoryRefT[]
}

export async function InvestmentSummaryPanel({
  investmentId,
  investmentName,
  canSeeMargin,
  expenseCategories,
}: PropsT) {
  const elapsed = perfStart()
  const [tree, depositTransactions, financialsSource] = await Promise.all([
    getKosztorysTree(investmentId),
    fetchDepositTransactionsForInvestment(investmentId),
    fetchWholeInvestmentFinancials(investmentId),
  ])
  const fetchMs = elapsed()

  const { financials, materialsBreakdown, settledBreakdown } = deriveWholeInvestmentFinancials(
    financialsSource,
    tree,
    expenseCategories,
  )

  const rows = treeToRows(tree)
  const clientTotals = kosztorysClientTotals(rows, tree.stages, tree.globalDiscount)
  const reading = readingFromKosztorys(clientTotals)
  // Gated here rather than at the prop below: the fold is stages × rows, so a MANAGER would pay it in
  // full only to have the result dropped.
  const subcontractorDue = canSeeMargin ? subcontractorDueByPlane(rows, tree.stages) : undefined

  const deriveMs = elapsed()
  console.log(
    `[PERF] InvestmentSummaryPanel ${fetchMs + deriveMs}ms ` +
      `(fetch ${fetchMs}ms, derive ${deriveMs}ms) [${rows.length} rows → laborCostsNetFromKosztorys + discountNetFromKosztorys]`,
  )

  return (
    <SummaryPanelContent
      investmentId={investmentId}
      investmentName={investmentName}
      depositTransactions={depositTransactions}
      materialsGrossBase={financials.materialsGrossBase}
      materialsNetBilled={financials.materialsNetBilled}
      materialsBreakdown={materialsBreakdown}
      settledBreakdown={settledBreakdown}
      financials={canSeeMargin ? financials : undefined}
      // Its own prop, deliberately outside the `financials` gate above: a strata lowers what the
      // client owes, so every reader of the settlement must see it.
      lossAmount={financials.totalLoss}
      {...reading}
      reconciliation={buildKosztorysReconciliation({
        laborCostsNetFromKosztorys: clientTotals.laborCostsNetFromKosztorys,
        discountNetFromKosztorys: clientTotals.discountNetFromKosztorys,
        laborCostsNetFromTransactions: financials.totalLaborCosts,
        discountNetFromTransactions: financials.totalDiscount,
      })}
      vatRate={tree.vatRate}
      settlementMode={tree.settlementMode}
      materialsNetRate={tree.materialsNetRate}
      subcontractorDue={subcontractorDue}
      host="investment"
    />
  )
}
