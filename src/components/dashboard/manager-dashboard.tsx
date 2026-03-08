import { formatPLN } from '@/lib/format-currency'
import { parsePagination } from '@/lib/pagination'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { fetchManagerDashboardData } from '@/lib/queries/dashboard'
import { DashboardTables } from '@/components/dashboard/dashboard-tables'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { StatCard } from '@/components/ui/stat-card'
import { perfStart } from '@/lib/perf'

type ManagerDashboardPropsT = {
  searchParams: Record<string, string | string[] | undefined>
}

export async function ManagerDashboard({ searchParams }: ManagerDashboardPropsT) {
  const step = perfStart()
  const { page, limit } = parsePagination(searchParams)

  const {
    visibleRegisters,
    activeInvestments,
    allInvestments,
    users,
    managementUsers,
    totalBalance,
    ownedBalance,
    virtualRegisters,
  } = await fetchManagerDashboardData()
  console.log(`[PERF] ManagerDashboard fetchManagerDashboardData ${step()}ms`)

  return (
    <PageWrapper title="Pulpit" backHref="">
      {/* Stat cards + cash registers */}

      <div className="mt-8 flex flex-wrap gap-4">
        <StatCard label="Saldo kas" value={formatPLN(totalBalance)} />
        {ownedBalance !== undefined && (
          <StatCard label="Saldo moich kas" value={formatPLN(ownedBalance)} />
        )}
        {virtualRegisters.map((vr) => (
          <StatCard key={vr.id} label={vr.name} value={formatPLN(vr.balance)} />
        ))}
        <StatCard label="Aktywne inwestycje" value={String(activeInvestments.length)} />
      </div>

      <DashboardTables
        cashRegisters={visibleRegisters}
        investments={allInvestments}
        users={users}
      />

      {/* Recent transactions */}
      <TransfersSection
        title="Ostatnie transakcje"
        config={{
          query: {
            where: buildTransferFilters(searchParams, { id: 0, isManager: true }),
            page,
            limit,
          },
          baseUrl: '/',
          filters: {
            cashRegisters: visibleRegisters.map((c) => ({ id: c.id, name: c.name })),
            investments: activeInvestments.map((i) => ({ id: i.id, name: i.name })),
            users: managementUsers,
          },
        }}
      />
    </PageWrapper>
  )
}
