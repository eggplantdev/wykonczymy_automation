import { Suspense } from 'react'
import { parsePagination } from '@/lib/pagination'
import { getEmployeeSaldo } from '@/lib/queries/employees'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { MONTHS } from '@/lib/constants/months'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { StatCard } from '@/components/ui/stat-card'

const EMPLOYEE_EXCLUDE_COLUMNS = [
  'type',
  'cashRegister',
  'worker',
  'otherCategory',
  'invoice',
  'paymentMethod',
]

type EmployeeDashboardServerPropsT = {
  userId: number
  searchParams: Record<string, string | string[] | undefined>
}

export async function EmployeeDashboardServer({
  userId,
  searchParams,
}: EmployeeDashboardServerPropsT) {
  const { page, limit } = parsePagination(searchParams)

  const from = typeof searchParams.from === 'string' ? searchParams.from : undefined
  const to = typeof searchParams.to === 'string' ? searchParams.to : undefined
  const hasDateRange = from && to

  const dateRange = hasDateRange ? { start: from, end: to } : undefined
  const periodSaldo = await getEmployeeSaldo(userId, dateRange)

  const saldoLabel = hasDateRange
    ? `Saldo — ${MONTHS[new Date(from + 'T00:00:00').getMonth()]} ${new Date(from + 'T00:00:00').getFullYear()}`
    : 'Saldo ogólne'

  const transfersLabel = hasDateRange
    ? `Transfery — ${MONTHS[new Date(from + 'T00:00:00').getMonth()]} ${new Date(from + 'T00:00:00').getFullYear()}`
    : 'Wszystkie transfery'

  const where = buildTransferFilters(searchParams, { id: userId, isManager: false })

  return (
    <PageWrapper title="Moje konto">
      <StatCard label={saldoLabel} value={formatPLN(periodSaldo)} className={`mt-6`} />

      <h2 className="text-foreground mt-8 text-lg font-medium">{transfersLabel}</h2>
      <Suspense fallback={<TransferTableSkeleton />}>
        <TransferTableServer
          where={where}
          page={page}
          limit={limit}
          excludeColumns={EMPLOYEE_EXCLUDE_COLUMNS}
          baseUrl="/"
          filters={{ showTypeFilter: false }}
          className="mt-4"
        />
      </Suspense>
    </PageWrapper>
  )
}
