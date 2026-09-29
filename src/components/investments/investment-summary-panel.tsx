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

// Scope rule on this host: every figure reports the WHOLE investment, so the panel scopes its own
// transaction-plane fetches to `{ investment }` and never sees the page's URL filters. The transfers
// table's own „Suma wybranych transakcji" is the one surface answering the filtered question.

type PropsT = {
  investmentId: number
  investmentName: string
  // ADMIN/OWNER only. Gates whether `financials` crosses into the client component at all — the
  // „Marża" tab's figures must stay out of a MANAGER's RSC payload, not merely off their screen.
  canSeeMargin: boolean
  expenseCategories: ExpenseCategoryRefT[]
}

// Every fetch and derivation the v2 reading needs is owned here rather than by the page, so the v1
// reading keeps the exact query set and computations it ran before this panel existed.
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
  // The crew side of „Marża rzeczywista". Computed from the tree already in hand rather than fetched
  // — the listing's SQL fold exists because 1000 investments cannot each ship their rows, which is
  // not this page's problem. „Prognoza" is deliberately not built here (decision 3): it is read where
  // the kosztorys is edited.
  //
  // Gated here rather than at the prop below: the fold is stages × rows, so a MANAGER would pay it in
  // full only to have the result dropped. The gate also keeps the crew's per-plane cost — company-plane
  // money — out of their RSC payload rather than merely off their screen.
  const subcontractorDue = canSeeMargin ? subcontractorDueByPlane(rows, tree.stages) : undefined

  // `derive` is the whole-tree → two-numbers reduction (treeToRows + kosztorysClientTotals). Logged
  // next to the row count it consumed, because that ratio is the argument for aggregating in SQL.
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
      // client owes, so every reader of the settlement must see it — only the marża figures are
      // owner-only.
      lossAmount={financials.totalLoss}
      {...reading}
      // An empty kosztorys against booked transfers is a REAL gap, not noise: it is legacy robocizna
      // nobody has entered here yet. It screams until someone does.
      reconciliation={buildKosztorysReconciliation({
        laborCostsNetFromKosztorys: clientTotals.laborCostsNetFromKosztorys,
        discountNetFromKosztorys: clientTotals.discountNetFromKosztorys,
        laborCostsNetFromTransactions: financials.totalLaborCosts,
        discountNetFromTransactions: financials.totalDiscount,
      })}
      vatRate={tree.vatRate}
      settlementMode={tree.settlementMode}
      materialsNetRate={tree.materialsNetRate}
      // No writers passed on purpose: these settings are edited in the kosztorys editor only, so
      // this panel renders no settings trigger at all. That also keeps every write off the one
      // route that renders the transfers table, which a route-wide re-render would rebuild.
      subcontractorDue={subcontractorDue}
      host="investment"
    />
  )
}
