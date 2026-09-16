import { parsePagination } from '@/lib/utils/pagination'
import { parseTransferSort } from '@/lib/queries/transfer-sort'
import { buildTransferFilters } from '@/lib/queries/transfer-filters'
import { fetchManagerDashboardData } from '@/lib/queries/dashboard'
import { UserRegisterStats } from '@/components/dashboard/user-register-stats'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SECTION_IDS } from '@/lib/constants/sections'
import { perfStart } from '@/lib/perf'

type ManagerDashboardPropsT = {
  searchParams: Record<string, string | string[] | undefined>
}

export async function ManagerDashboard({ searchParams }: ManagerDashboardPropsT) {
  const step = perfStart()
  const { page, limit } = parsePagination(searchParams)
  const sort = parseTransferSort(searchParams)

  const {
    visibleRegisters,
    activeInvestments,
    managementUsers,
    otherCategories,
    expenseCategories,
    isAdminOrOwner,
  } = await fetchManagerDashboardData()
  console.log(`[PERF] ManagerDashboard fetchManagerDashboardData ${step()}ms`)

  return (
    <PageWrapper title="Transakcje">
      <UserRegisterStats cashRegisters={visibleRegisters} showAllRegisters={isAdminOrOwner} />

      {/* Recent transactions */}
      <TransfersSection
        id={SECTION_IDS.transactions}
        config={{
          query: {
            where: buildTransferFilters(searchParams, { id: 0 }),
            page,
            limit,
            sort,
          },
          baseUrl: '/',
          cancelledTransactionAudit: searchParams.cancelledTransactionAudit === '1',
          // TODO: Consider restricting manager's transaction table to only transactions
          // from/to registers they own (currently managers see all transactions).
          // Intentionally inline — manager sees only visible registers and active investments.
          // Entity pages use buildFilterConfig(refData) with full data since they're already scoped
          // to one investment/user. Reports page is not accessible to managers at all.
          filters: {
            cashRegisters: visibleRegisters.map((c) => ({ id: c.id, name: c.name })),
            investments: activeInvestments.map((i) => ({ id: i.id, name: i.name })),
            users: managementUsers,
            otherCategories,
            expenseCategories,
            showPaymentMethodFilter: false,
          },
        }}
      />
    </PageWrapper>
  )
}
