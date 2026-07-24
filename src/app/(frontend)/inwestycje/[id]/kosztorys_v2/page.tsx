import { parseInvestmentId, requireInvestmentOr404 } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import {
  fetchCategoryBreakdowns,
  fetchFilteredByType,
  fetchPayoutsByWorkerForInvestment,
  fetchPayoutTransactionsForInvestment,
  fetchDepositTransactionsForInvestment,
  fetchReferenceData,
} from '@/lib/queries/reference-data'
import { findTransfersRaw } from '@/lib/queries/transfers'
import { EXPENSES_TAB_TYPES } from '@/lib/constants/transfers'
import { deriveFinancials } from '@/lib/db/sum-transfers'
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
  // The individual deposit rows — feed the client Podsumowanie's sortable wpłaty list.
  const depositTxPromise = fetchDepositTransactionsForInvestment(investmentId)
  // The individual materiały rows for the Podsumowanie's wydatki list — reuse the existing transfers
  // fetch (same rows the investment page's expenses table renders), scoped to this investment's
  // INVESTMENT_EXPENSE + CORRECTION. Both settled states come back: the list toggle splits the
  // client-facing „Wydatki inwestycyjne" (unsettled, Σ === materialsGross) from the owner-only
  // „Materiały wliczone w robociznę" (settled). limit: 0 = all rows.
  const materialTxPromise = findTransfersRaw({
    where: {
      investment: { equals: investmentId },
      type: { in: [...EXPENSES_TAB_TYPES] },
      cancelled: { not_equals: true },
    },
    page: 1,
    limit: 0,
    sort: '-date',
  })
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
    depositTransactions,
    { docs: materialTransactionDocs },
  ] = await Promise.all([
    investmentPromise,
    treePromise,
    financialsPromise,
    breakdownsPromise,
    fetchReferenceData(),
    payoutsPromise,
    payoutTxPromise,
    depositTxPromise,
    materialTxPromise,
  ])
  // categoryCosts feed the Materiały split; settledCategoryCosts stay unused here — settled
  // material („wliczone w robociznę") is an owner/margin figure, deliberately kept off the
  // client-facing offer (v1 parity).
  const financials = deriveFinancials(typeDistribution, breakdowns.categoryCosts)
  const materialsGross = financials.totalMaterialCosts
  // v1 client-facing „Materiały" split by expense category; Σ === materialsGross, so the
  // podsumowanie stays byte-identical to the investment page's materiały.
  const materialyBreakdown = buildMaterialyBreakdown(financials, refData.expenseCategories)
  // „Wpłaty" = only INVESTOR_DEPOSIT rows — the same base the deposit list, Wpłaty tab, plane pie,
  // and Mieszane draw (COMPANY_FUNDING / OTHER_DEPOSIT are legacy and stay out of client wpłaty, per
  // getDepositTransactionsForInvestment). Drives the podsumowanie „Wpłaty"/„Do zapłaty".
  const wplatyNet = depositTransactions.reduce((sum, deposit) => sum + deposit.amount, 0)
  // Names join here (not in the cached query): resolve each worker id against reference data; a null
  // worker id is the „Bez przypisanego pracownika" bucket. Sorting/totals live in the pure block helper.
  const workerNameById = new Map(refData.workers.map((worker) => [worker.id, worker.name]))
  // Category names join here (not in the cached query) — same pattern as worker names below. A null
  // category is the legacy uncategorised bucket; a CORRECTION labels as „Korekta".
  const expenseCategoryNameById = new Map(
    refData.expenseCategories.map((category) => [category.id, category.name]),
  )
  // depth: 0 → `expenseCategory` is a raw id (null for a legacy uncategorised row / a CORRECTION).
  const materialTransactions = materialTransactionDocs.map((doc) => ({
    id: Number(doc.id),
    date: String(doc.date),
    amount: Number(doc.amount),
    description: doc.description != null ? String(doc.description) : null,
    settled: doc.settled === true,
    label:
      doc.expenseCategory != null
        ? (expenseCategoryNameById.get(Number(doc.expenseCategory)) ?? 'Nieznana kategoria')
        : doc.type === 'CORRECTION'
          ? 'Korekta'
          : 'Bez kategorii',
  }))
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
      materialsGross={materialsGross}
      materialyBreakdown={materialyBreakdown}
      wplatyNet={wplatyNet}
      // Transaction-sourced robocizna/rabat (Σ LABOR_COST / Σ RABAT) for the in-editor reconciliation
      // scream — compared against the kosztorys figures during the population/verification transition.
      laborCostsNetFromTransactions={financials.totalLaborCosts}
      investmentRabat={financials.totalRabat}
      payoutsByWorker={payoutsByWorker}
      payoutTransactions={payoutTransactions}
      depositTransactions={depositTransactions}
      materialTransactions={materialTransactions}
    />
  )
}
