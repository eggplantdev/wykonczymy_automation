import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import {
  fetchReferenceData,
  fetchFilteredByType,
  fetchCategoryBreakdown,
} from '@/lib/queries/reference-data'
import { deriveFinancials } from '@/lib/db/sum-transfers'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { buildFinancialFields } from '@/lib/map-category-costs'
import { perfStart } from '@/lib/perf'
import { buildFilterConfig } from '@/lib/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { ReportChart } from '@/components/reports/report-charts'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { FinancialStats } from '@/components/investments/financial-stats'
import type { HeaderFieldT } from '@/types/export'
import type { PagePropsT } from '@/types/page'

export default async function TransactionsReportPage({ searchParams }: PagePropsT) {
  const session = await requireAuth(ADMIN_OR_OWNER_ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session

  const step = perfStart()

  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })

  const [refData, typeDistribution, categoryBreakdown] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredByType(urlFilters),
    fetchCategoryBreakdown(urlFilters),
  ])
  console.log(`[PERF] raporty data fetch ${step()}ms`)

  const financials = deriveFinancials(typeDistribution, categoryBreakdown)

  const headerFields: HeaderFieldT[] = [
    { label: 'Transakcje', value: 'Raport' },
    ...buildFinancialFields(financials, refData.expenseCategories),
  ]

  return (
    <PageWrapper title="Raporty">
      <FinancialStats
        fields={headerFields.filter((f) => f.amount !== undefined)}
        totalPayouts={financials.totalPayouts}
      />

      <ReportChart financials={financials} expenseCategories={refData.expenseCategories} />

      <TransfersSection
        config={{
          query: { where: urlFilters, page, limit },
          baseUrl: '/raporty',
          filters: buildFilterConfig(refData),
          headerFields,
          totalPayouts: financials.totalPayouts,
        }}
      />
    </PageWrapper>
  )
}
