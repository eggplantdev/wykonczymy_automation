import { requireManagementPage } from '@/lib/auth/require-management-page'
import { parsePagination } from '@/lib/utils/pagination'
import { parseTransferSort } from '@/lib/queries/transfer-sort'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { buildPayoutFilters } from '@/lib/queries/transfer-filters'
import { buildFilterConfig } from '@/lib/utils/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'
import type { PagePropsT } from '@/types/page'

export default async function PayoutsPage({ searchParams }: PagePropsT) {
  const user = await requireManagementPage()
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)
  const sort = parseTransferSort(sp)

  const where = buildPayoutFilters(sp, { id: user.id })
  const refData = await fetchReferenceData()

  return (
    <PageWrapper title={PAGE_TITLES.payouts}>
      <TransfersSection
        config={{
          query: { where, page, limit, sort },
          baseUrl: '/wyplaty',
          excludeColumns: ['type'],
          filters: { ...buildFilterConfig(refData, 'type'), showPayoutStatusFilter: true },
          print: true,
          cancelledTransactionAudit: sp.cancelledTransactionAudit === '1',
        }}
      />
    </PageWrapper>
  )
}
