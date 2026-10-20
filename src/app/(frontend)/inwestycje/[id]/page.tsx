import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { parseInvestmentId } from '@/lib/queries/investment-id'
import { parsePagination } from '@/lib/utils/pagination'
import { transferSort } from '@/lib/transfers/sortable-columns'
import {
  fetchInvestmentDetails,
  fetchReferenceData,
  findInvestmentRef,
  withDetails,
} from '@/lib/queries/reference-data'
import { InvestmentSummaryPanel } from '@/components/investments/investment-summary-panel'
import { InvestmentOverview } from '@/components/investments/investment-overview'
import { fetchInvestmentAssets } from '@/lib/queries/investment-assets'
import { StatsVersionToggle } from '@/components/investments/stats-version-toggle'
import { parseStatsVersion, STATS_VERSION_PARAM } from '@/lib/constants/stats-version'
import { buildTransferFilters, statsWhereFrom } from '@/lib/queries/transfer-filters'
import { perfStart } from '@/lib/perf'
import { buildFilterConfig } from '@/lib/utils/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InvestmentV1Stats } from '@/components/investments/investment-v1-stats'
import type { DynamicPagePropsT } from '@/types/page'

export default async function InvestmentDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const user = await requireManagementPage()

  const step = perfStart()

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)
  const sort = transferSort.parse(sp)

  const investmentId = parseInvestmentId(id)
  const urlFilters = buildTransferFilters(sp, { id: user.id })
  const transferWhere = { ...urlFilters, investment: { equals: investmentId } }

  const statsWhere = statsWhereFrom(transferWhere)

  const version = parseStatsVersion(sp[STATS_VERSION_PARAM])

  const [refData, detailsById, assets] = await Promise.all([
    fetchReferenceData(),
    fetchInvestmentDetails(),
    fetchInvestmentAssets(investmentId),
  ])
  console.log(`[PERF] inwestycje/${id} data fetch ${step()}ms`)

  const found = findInvestmentRef(refData, investmentId)
  if (!found) notFound()
  const { trashed } = found
  const investment = withDetails(found.investment, detailsById)

  return (
    <PageWrapper title={investment.name}>
      <InvestmentOverview investment={investment} trashed={trashed} assets={assets} showKosztorysButton />

      {/* The two readings render different trees, so a toggle living inside them moves under the
          cursor on every switch. */}
      <div className="w-fit">
        <StatsVersionToggle version={version} />
      </div>

      {version === 'v1' ? (
        <Suspense fallback={null}>
          <InvestmentV1Stats
            statsWhere={statsWhere}
            materialsNetRate={investment.materialsNetRate}
            settlementMode={investment.settlementMode}
            expenseCategories={refData.expenseCategories}
          />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <InvestmentSummaryPanel
            investmentId={investmentId}
            investmentName={investment.name}
            canSeeMargin={isAdminOrOwnerRole(user.role)}
            expenseCategories={refData.expenseCategories}
          />
        </Suspense>
      )}

      <TransfersSection
        title="Transfery"
        config={{
          query: { where: transferWhere, page, limit, sort },
          baseUrl: `/inwestycje/${id}`,
          excludeColumns: ['investment'],
          filters: buildFilterConfig(refData, 'investments'),
          invoiceDownload: true,
          print: true,
          cancelledTransactionAudit: sp.cancelledTransactionAudit === '1',
        }}
      />
    </PageWrapper>
  )
}
