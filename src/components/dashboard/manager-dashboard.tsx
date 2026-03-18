import { parsePagination } from '@/lib/pagination'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { fetchManagerDashboardData } from '@/lib/queries/dashboard'
import { DashboardTables } from '@/components/dashboard/dashboard-tables'
import { UserRegisterStats } from '@/components/dashboard/user-register-stats'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SECTION_IDS } from '@/lib/constants/sections'
import { perfStart } from '@/lib/perf'

type ManagerDashboardPropsT = {
  searchParams: Record<string, string | string[] | undefined>
  currentUserName: string
}

export async function ManagerDashboard({ searchParams, currentUserName }: ManagerDashboardPropsT) {
  const step = perfStart()
  const { page, limit } = parsePagination(searchParams)

  const { visibleRegisters, activeInvestments, allInvestments, managementUsers, otherCategories } =
    await fetchManagerDashboardData()
  console.log(`[PERF] ManagerDashboard fetchManagerDashboardData ${step()}ms`)

  return (
    <PageWrapper title="Pulpit" backHref="">
      <UserRegisterStats cashRegisters={visibleRegisters} currentUserName={currentUserName} />

      <DashboardTables cashRegisters={visibleRegisters} investments={allInvestments} />

      {/* Recent transactions */}
      <TransfersSection
        title="Ostatnie transakcje"
        id={SECTION_IDS.transactions}
        config={{
          query: {
            where: buildTransferFilters(searchParams, { id: 0, isManager: true }),
            page,
            limit,
          },
          baseUrl: '/',
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
            showPaymentMethodFilter: false,
          },
        }}
      />
    </PageWrapper>
  )
}
