import { parsePagination } from '@/lib/utils/pagination'
import { parseTransferSort } from '@/lib/queries/transfer-sort'
import { buildTransferFilters } from '@/lib/queries/transfer-filters'
import { dashboardFilterOptions } from '@/lib/queries/dashboard'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import type { RoleT } from '@/lib/auth/roles'
import { ManagerDashboardPanels } from '@/components/dashboard/manager-dashboard-panels'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SmsTestDialog } from '@/components/dashboard/sms-test-dialog'
import { PAGE_TITLES, SECTION_IDS } from '@/lib/constants/sections'
import { TRANSFER_TYPES } from '@/lib/constants/transfers'
import { toOptions } from '@/lib/utils/build-filter-config'

type ManagerDashboardPropsT = {
  searchParams: Record<string, string | string[] | undefined>
  user: { id: number; role: RoleT }
}

export async function ManagerDashboard({ searchParams, user }: ManagerDashboardPropsT) {
  const { page, limit } = parsePagination(searchParams)
  const sort = parseTransferSort(searchParams)

  const referenceDataBase = await fetchReferenceData()
  const filters = dashboardFilterOptions(referenceDataBase, user.role)
  const where = buildTransferFilters(searchParams, { id: 0 })

  return (
    <PageWrapper title={PAGE_TITLES.transactions}>
      <SmsTestDialog />

      <ManagerDashboardPanels
        referenceData={{
          ...referenceDataBase,
          currentUserId: user.id,
          currentUserRole: user.role,
        }}
      />

      <TransfersSection
        id={SECTION_IDS.transactions}
        config={{
          query: {
            where,
            page,
            limit,
            sort,
          },
          baseUrl: '/',
          cancelledTransactionAudit: searchParams.cancelledTransactionAudit === '1',
          onlyWorkerDrafts: searchParams.workerDrafts === '1',
          duplicateFinder: true,
          // TODO: Consider restricting manager's transaction table to only transactions
          // from/to registers they own (currently managers see all transactions).
          filters: {
            ...filters,
            workers: toOptions(referenceDataBase.workers),
            transferTypes: TRANSFER_TYPES,
            showPaymentMethodFilter: false,
            showWorkerDraftsFilter: true,
          },
        }}
      />
    </PageWrapper>
  )
}
