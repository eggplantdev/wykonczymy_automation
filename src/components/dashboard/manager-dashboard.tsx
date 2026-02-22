import { formatPLN } from '@/lib/format-currency'
import { parsePagination } from '@/lib/pagination'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { fetchManagerDashboardData } from '@/lib/queries/dashboard'
import { DashboardTables } from '@/components/dashboard/dashboard-tables'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { StatCard } from '@/components/ui/stat-card'

type ManagerDashboardPropsT = {
  searchParams: Record<string, string | string[] | undefined>
}

export async function ManagerDashboard({ searchParams }: ManagerDashboardPropsT) {
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
    isAdminOrOwner,
  } = await fetchManagerDashboardData()

  return (
    <PageWrapper title="Kokpit">
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
        showSyncButton={isAdminOrOwner}
      />

      {/* Recent transactions */}
      <TransfersSection
        title="Ostatnie transakcje"
        className="mt-8"
        where={buildTransferFilters(searchParams, { id: 0, isManager: true })}
        page={page}
        limit={limit}
        baseUrl="/"
        filters={{
          cashRegisters: visibleRegisters.map((c) => ({ id: c.id, name: c.name })),
          investments: activeInvestments.map((i) => ({ id: i.id, name: i.name })),
          users: managementUsers,
        }}
      />
    </PageWrapper>
  )
}
