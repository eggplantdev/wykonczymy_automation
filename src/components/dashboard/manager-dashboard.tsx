import { parsePagination } from '@/lib/utils/pagination'
import { parseTransferSort } from '@/lib/queries/transfer-sort'
import { buildTransferFilters, narrowToTransferIds } from '@/lib/queries/transfer-filters'
import { fetchManagerDashboardData } from '@/lib/queries/dashboard'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import {
  fetchDraftTransferIds,
  fetchPendingExpenseDrafts,
  fetchRejectedExpenseDrafts,
} from '@/lib/queries/worker-expense-drafts'
import type { RoleT } from '@/lib/auth/roles'
import { UserRegisterStats } from '@/components/dashboard/user-register-stats'
import { PendingExpenseDrafts } from '@/components/worker-expenses/pending-expense-drafts'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES, SECTION_IDS } from '@/lib/constants/sections'
import { perfStart } from '@/lib/perf'

type ManagerDashboardPropsT = {
  searchParams: Record<string, string | string[] | undefined>
  user: { id: number; role: RoleT }
}

export async function ManagerDashboard({ searchParams, user }: ManagerDashboardPropsT) {
  const step = perfStart()
  const { page, limit } = parsePagination(searchParams)
  const sort = parseTransferSort(searchParams)
  const showWorkerDrafts = searchParams.workerDrafts === '1'

  const [
    {
      visibleRegisters,
      activeInvestments,
      managementUsers,
      otherCategories,
      expenseCategories,
      isAdminOrOwner,
    },
    pendingDrafts,
    referenceDataBase,
    draftTransferIds,
    rejectedDrafts,
  ] = await Promise.all([
    fetchManagerDashboardData(),
    fetchPendingExpenseDrafts(),
    fetchReferenceData(),
    showWorkerDrafts ? fetchDraftTransferIds() : undefined,
    showWorkerDrafts ? fetchRejectedExpenseDrafts() : undefined,
  ])
  const where = buildTransferFilters(searchParams, { id: 0 })
  console.log(`[PERF] ManagerDashboard fetchManagerDashboardData ${step()}ms`)

  return (
    <PageWrapper title={PAGE_TITLES.transactions}>
      <UserRegisterStats cashRegisters={visibleRegisters} showAllRegisters={isAdminOrOwner} />

      <PendingExpenseDrafts
        drafts={pendingDrafts}
        referenceData={{
          ...referenceDataBase,
          currentUserId: user.id,
          currentUserRole: user.role,
        }}
      />

      {/* Recent transactions */}
      <TransfersSection
        id={SECTION_IDS.transactions}
        config={{
          query: {
            where: draftTransferIds ? narrowToTransferIds(where, draftTransferIds) : where,
            page,
            limit,
            sort,
          },
          baseUrl: '/',
          rejectedDrafts,
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
            showWorkerDraftsFilter: true,
          },
        }}
      />
    </PageWrapper>
  )
}
