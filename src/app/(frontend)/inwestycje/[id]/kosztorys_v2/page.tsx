import { parseInvestmentId, requireInvestmentOr404 } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import {
  fetchCategoryBreakdowns,
  fetchDepositRowsForInvestment,
  fetchFilteredByType,
  fetchPayoutsByWorkerForInvestment,
  fetchPayoutTransactionsForInvestment,
  fetchReferenceData,
} from '@/lib/queries/reference-data'
import { deriveFinancials } from '@/lib/db/sum-transfers'
import { reduceDepositBuckets } from '@/lib/kosztorys/summary-economics'
import { UNASSIGNED_WORKER_NAME } from '@/lib/kosztorys/subcontractor-summary'
import { buildMaterialyBreakdown } from '@/lib/db/map-category-costs'
import { KosztorysEditorV2 } from '@/components/kosztorys/kosztorys-editor-v2'

// The in-app kosztorys editor ("kosztorys_v2"). Always available — every investment has one,
// the editor renders its own empty state. The legacy Google Sheet lives at /kosztorys.
export default async function InvestmentKosztorysV2Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const investmentId = parseInvestmentId(id)

  const investmentWhere = { investment: { equals: investmentId } }
  const treePromise = getKosztorysTree(investmentId)
  // Read-only bridge to the financial plane: the investment's live material spend (unsettled
  // INVESTMENT_EXPENSE + CORRECTION), summed via the same cached path the detail page uses.
  const financialsPromise = fetchFilteredByType(investmentWhere)
  // Per-expense-category split for the „Materiały" breakdown (v1 mirror parity).
  const breakdownsPromise = fetchCategoryBreakdowns(investmentWhere)
  // Realized PAYOUTs per worker (null-worker bucket kept) for the subcontractor summary block.
  const payoutsPromise = fetchPayoutsByWorkerForInvestment(investmentId)
  // The individual realized PAYOUT rows — feed the subcontractor block's sortable wypłaty list.
  const payoutTxPromise = fetchPayoutTransactionsForInvestment(investmentId)
  // The investor deposit rows — bucketed by plane (netto/brutto/legacy) for „Wpłaty"/„Do zapłaty".
  const depositRowsPromise = fetchDepositRowsForInvestment(investmentId)
  // Folded into the same Promise.all as everything else so the 404 lookup runs concurrently with the
  // data fetches rather than gating them; its notFound() rejection propagates through Promise.all.
  const investmentPromise = requireInvestmentOr404(id)
  const [
    { investment },
    tree,
    typeDistribution,
    breakdowns,
    refData,
    payouts,
    payoutTransactions,
    depositRows,
  ] = await Promise.all([
    investmentPromise,
    treePromise,
    financialsPromise,
    breakdownsPromise,
    fetchReferenceData(),
    payoutsPromise,
    payoutTxPromise,
    depositRowsPromise,
  ])
  // categoryCosts feed the Materiały split; settledCategoryCosts stay unused here — settled
  // material („wliczone w robociznę") is an owner/margin figure, deliberately kept off the
  // client-facing offer (v1 parity).
  const financials = deriveFinancials(typeDistribution, breakdowns.categoryCosts)
  const materialsNet = financials.totalMaterialCosts
  // v1 client-facing „Materiały" split by expense category; Σ === materialsNet, so the
  // podsumowanie stays byte-identical to the investment page's materiały.
  const materialyBreakdown = buildMaterialyBreakdown(financials, refData.expenseCategories)
  // „Wpłaty" split by plane: netto/brutto flagged buckets + legacy (pre-flag) — drives the
  // podsumowanie „Wpłaty"/„Do zapłaty". Σ buckets === totalIncome (every deposit lands in exactly one).
  const depositBuckets = reduceDepositBuckets(depositRows)
  // Names join here (not in the cached query): resolve each worker id against reference data; a null
  // worker id is the „Bez przypisanego pracownika" bucket. Sorting/totals live in the pure block helper.
  const workerNameById = new Map(refData.workers.map((worker) => [worker.id, worker.name]))
  const payoutsByWorker = payouts.map((row) => ({
    ...row,
    name:
      row.workerId === null
        ? UNASSIGNED_WORKER_NAME
        : (workerNameById.get(row.workerId) ?? 'Nieznany pracownik'),
  }))

  return (
    <KosztorysEditorV2
      investmentId={investmentId}
      tree={tree}
      investmentName={investment.name}
      materialsNet={materialsNet}
      materialyBreakdown={materialyBreakdown}
      depositBuckets={depositBuckets}
      // Transaction-sourced robocizna/rabat (Σ LABOR_COST / Σ RABAT) for the in-editor reconciliation
      // scream — compared against the kosztorys figures during the population/verification transition.
      laborCostsNetFromTransactions={financials.totalLaborCosts}
      investmentRabat={financials.totalRabat}
      payoutsByWorker={payoutsByWorker}
      payoutTransactions={payoutTransactions}
    />
  )
}
