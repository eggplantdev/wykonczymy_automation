import { notFound } from 'next/navigation'
import { parseInvestmentId } from '@/lib/queries/investment-id'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { getWorkCatalogue } from '@/lib/queries/work-catalogue'
import { fetchInvestmentAssets } from '@/lib/queries/investment-assets'
import {
  fetchInvestmentNotes,
  fetchReferenceData,
  findInvestmentRef,
  withNotes,
} from '@/lib/queries/reference-data'
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
import { kosztorysEditorActions } from '@/components/kosztorys/editor/actions/kosztorys-editor-actions'
import { perfStart } from '@/lib/perf'
import { investmentLockOf } from '@/lib/constants/investment-lock'
import { countInvestmentPendingReports } from '@/lib/queries/worker-reports-list'
import { REPORT_PARAM } from '@/lib/kosztorys/worker-report/report-param'
import { parseIdParam } from '@/lib/utils/parse-id-param'
import type { ResolvedSearchParamsT } from '@/types/page'

export default async function InvestmentKosztorysV2Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<ResolvedSearchParamsT>
}) {
  const elapsed = perfStart()
  const { id } = await params
  const openReportId = parseIdParam((await searchParams)[REPORT_PARAM])
  const investmentId = parseInvestmentId(id)
  // getKosztorysTree throws — for a failed session AND for a missing investment — so anything
  // folded into the Promise.all beside it is racing that throw for the right to decide what the user sees.
  const user = await requireManagementPage()
  const [refData, notesById] = await Promise.all([fetchReferenceData(), fetchInvestmentNotes()])
  const found = findInvestmentRef(refData, investmentId)
  if (!found) notFound()
  const { investment, trashed } = found

  const treePromise = getKosztorysTree(investmentId)
  const financialsPromise = fetchWholeInvestmentFinancials(investmentId)
  const payoutTxPromise = fetchPayoutTransactionsForInvestment(investmentId)
  const depositTxPromise = fetchDepositTransactionsForInvestment(investmentId)
  const materialTxPromise = fetchMaterialTransactionsForInvestment(investmentId)
  const workCataloguePromise = getWorkCatalogue()
  const assetsPromise = fetchInvestmentAssets(investmentId)
  const pendingReportsPromise = countInvestmentPendingReports(investmentId)
  const [
    tree,
    financialsSource,
    payoutTransactions,
    depositTransactions,
    materialTransactions,
    workCatalogue,
    assets,
    pendingReportCount,
  ] = await Promise.all([
    treePromise,
    financialsPromise,
    payoutTxPromise,
    depositTxPromise,
    materialTxPromise,
    workCataloguePromise,
    assetsPromise,
    pendingReportsPromise,
  ])
  console.log(
    `[PERF] kosztorys_v2/${investmentId} 8-fetch fan-out ${elapsed()}ms ` +
      `(tree + financials source + 3 transaction lists + work catalogue + assets + pending reports)`,
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
      actions={kosztorysEditorActions}
      materialsGrossBase={financials.materialsGrossBase}
      materialsNetBilled={financials.materialsNetBilled}
      materialsBreakdown={materialsBreakdown}
      settledBreakdown={settledBreakdown}
      financials={isAdminOrOwnerRole(user.role) ? financials : undefined}
      laborCostsNetFromTransactions={financials.totalLaborCosts}
      discountNetFromTransactions={financials.totalDiscount}
      investmentLoss={financials.totalLoss}
      payoutTransactions={payoutTransactions}
      depositTransactions={depositTransactions}
      materialTransactions={materialTransactions}
      workers={refData.workers}
      workCatalogue={workCatalogue}
      assets={assets}
      investment={withNotes(investment, notesById)}
      hasSheet={investment.hasSheet}
      lock={investmentLockOf({ status: investment.status, trashed })}
      workerReports={{
        pendingCount: pendingReportCount,
        openReportId,
      }}
    />
  )
}
