import { Suspense } from 'react'
import { formatPLN } from '@/lib/format-currency'
import { parsePagination } from '@/lib/pagination'
import { buildTransferFilters, countRecentTransfers } from '@/lib/queries/transfers'
import { findAllCashRegistersRaw, mapCashRegisterRows } from '@/lib/queries/cash-registers'
import { findActiveInvestments, findAllInvestments } from '@/lib/queries/investments'
import { findAllUsersWithSaldos } from '@/lib/queries/users'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { DashboardTables, CashRegistersTable } from '@/components/dashboard/dashboard-tables'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { StatCard } from '@/components/ui/stat-card'
import { SyncBalancesButton } from '@/components/dashboard/sync-balances-button'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'

type ManagerDashboardPropsT = {
  searchParams: Record<string, string | string[] | undefined>
}

export async function ManagerDashboard({ searchParams }: ManagerDashboardPropsT) {
  const { page, limit } = parsePagination(searchParams)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]

  // Phase 1: all depth:0 queries in parallel
  const [rawCashRegisters, activeInvestments, allInvestments, users, recentCount, refData] =
    await Promise.all([
      findAllCashRegistersRaw(),
      findActiveInvestments(),
      findAllInvestments(),
      findAllUsersWithSaldos(),
      countRecentTransfers(sinceDate),
      fetchReferenceData(),
    ])

  const workersMap = new Map(refData.workers.map((w) => [w.id, w.name]))
  const cashRegisters = mapCashRegisterRows(rawCashRegisters, workersMap)

  const user = await getCurrentUserJwt()
  const isAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER'

  const visibleRegisters = isAdminOrOwner
    ? cashRegisters
    : cashRegisters.filter((cr) => cr.type === 'AUXILIARY')

  const totalBalance = visibleRegisters.reduce((sum, cr) => sum + cr.balance, 0)

  return (
    <PageWrapper title="Kokpit">
      {/* Stat cards + cash registers */}
      <CollapsibleSection title="Kasy" className="mt-6">
        <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <CashRegistersTable data={visibleRegisters} />
            {isAdminOrOwner && (
              <div className="mt-4 flex justify-end">
                <SyncBalancesButton />
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <StatCard label="Saldo kas" value={formatPLN(totalBalance)} />
              <StatCard label="Aktywne inwestycje" value={String(activeInvestments.length)} />
              <StatCard label="Transfery (30 dni)" value={String(recentCount)} />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Users & Investments — full width */}
      <DashboardTables investments={allInvestments} users={users} />

      {/* Recent transactions */}
      <CollapsibleSection title="Ostatnie transfery" className="mt-8">
        <div className="mt-4">
          <Suspense fallback={<TransferTableSkeleton />}>
            <TransferTableServer
              where={buildTransferFilters(searchParams, { id: 0, isManager: true })}
              page={page}
              limit={limit}
              baseUrl="/"
              filters={{
                cashRegisters: visibleRegisters.map((c) => ({ id: c.id, name: c.name })),
                investments: activeInvestments.map((i) => ({ id: i.id, name: i.name })),
              }}
            />
          </Suspense>
        </div>
      </CollapsibleSection>
    </PageWrapper>
  )
}
