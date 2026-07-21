import { parseInvestmentId, requireInvestmentOr404 } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import {
  fetchCategoryBreakdowns,
  fetchFilteredByType,
  fetchPayoutsByWorkerForInvestment,
  fetchReferenceData,
  fetchZaliczkiByStage,
} from '@/lib/queries/reference-data'
import { deriveFinancials } from '@/lib/db/sum-transfers'
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
  // Per-etap zaliczki (tagged deposits) — same cached transfers plane, read-only.
  const zaliczkiPromise = fetchZaliczkiByStage(investmentId)
  // Realized PAYOUTs per worker (null-worker bucket kept) for the subcontractor summary block.
  const payoutsPromise = fetchPayoutsByWorkerForInvestment(investmentId)
  const { investment } = await requireInvestmentOr404(id)
  const [tree, typeDistribution, breakdowns, refData, zaliczkiByStage, payouts] = await Promise.all(
    [
      treePromise,
      financialsPromise,
      breakdownsPromise,
      fetchReferenceData(),
      zaliczkiPromise,
      payoutsPromise,
    ],
  )
  // categoryCosts feed the Materiały split; settledCategoryCosts stay unused here — settled
  // material („wliczone w robociznę") is an owner/margin figure, deliberately kept off the
  // client-facing offer (v1 parity).
  const financials = deriveFinancials(typeDistribution, breakdowns.categoryCosts)
  const materialsNet = financials.totalMaterialCosts
  // v1 client-facing „Materiały" split by expense category; Σ === materialsNet, so the
  // podsumowanie stays byte-identical to the investment page's materiały.
  const materialyBreakdown = buildMaterialyBreakdown(financials, refData.expenseCategories)
  // „Wpłaty" = every deposit on the investment (totalIncome) — the money that raises Bilans
  // inwestora (calculate-balance.ts). Drives the podsumowanie „Wpłaty"/„Do zapłaty"; distinct
  // from the sparser per-etap tagged zaliczki below.
  const wplatyNet = financials.totalIncome
  // Names join here (not in the cached query): resolve each worker id against reference data; a null
  // worker id is the „Bez przypisanego pracownika" bucket. Sorting/totals live in the pure block helper.
  const workerNameById = new Map(refData.workers.map((worker) => [worker.id, worker.name]))
  const payoutsByWorker = payouts.map((row) => ({
    ...row,
    name:
      row.workerId === null
        ? 'Bez przypisanego pracownika'
        : (workerNameById.get(row.workerId) ?? 'Nieznany pracownik'),
  }))

  return (
    <KosztorysEditorV2
      investmentId={investmentId}
      tree={tree}
      investmentName={investment.name}
      materialsNet={materialsNet}
      materialyBreakdown={materialyBreakdown}
      wplatyNet={wplatyNet}
      zaliczkiByStage={zaliczkiByStage}
      // Transaction-sourced robocizna/rabat (Σ LABOR_COST / Σ RABAT) for the in-editor reconciliation
      // scream — compared against the kosztorys figures during the population/verification transition.
      laborCostsNetFromTransactions={financials.totalLaborCosts}
      investmentRabat={financials.totalRabat}
      payoutsByWorker={payoutsByWorker}
    />
  )
}
