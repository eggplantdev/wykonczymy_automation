import { Suspense } from 'react'
import { formatPLN } from '@/lib/format-currency'
import { parsePagination } from '@/lib/pagination'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { fetchManagerDashboardData } from '@/lib/queries/dashboard'
import { DashboardTables, CashRegistersTable } from '@/components/dashboard/dashboard-tables'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { StatCard } from '@/components/ui/stat-card'
import { SyncBalancesButton } from '@/components/dashboard/sync-balances-button'

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
    recentCount,
    totalBalance,
    isAdminOrOwner,
  } = await fetchManagerDashboardData()

  return (
    <PageWrapper title="Kokpit">
      {/* Stat cards + cash registers */}
      <CollapsibleSection title="Kasy" className="mt-6">
        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <CashRegistersTable data={visibleRegisters} />
            {isAdminOrOwner && (
              <div className="mt-2 flex justify-end">
                <SyncBalancesButton />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard label="Saldo kas" value={formatPLN(totalBalance)} />
            <StatCard label="Aktywne inwestycje" value={String(activeInvestments.length)} />
            <StatCard label="Transfery (30 dni)" value={String(recentCount)} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Users & Investments — full width */}
      <DashboardTables investments={allInvestments} users={users} />

      {/* Recent transactions */}
      <CollapsibleSection title="Ostatnie transfery" className="mt-8">
        <Suspense fallback={<TransferTableSkeleton />}>
          <TransferTableServer
            className={`mt-4`}
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
        </Suspense>
      </CollapsibleSection>
    </PageWrapper>
  )
}
