import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { formatPLN } from '@/lib/format-currency'
import { parsePagination } from '@/lib/pagination'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { getUserDetail } from '@/lib/queries/users'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'

import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { InfoList } from '@/components/ui/info-list'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PrintButton } from '@/components/ui/print-button'
import { StatCard } from '@/components/ui/stat-card'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'

const EXCLUDE_COLUMNS = ['worker', 'otherCategory', 'invoice']

type PagePropsT = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function UserDetailPage({ params, searchParams }: PagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const baseFilters = buildTransferFilters(sp, { id: Number(id), isManager: false })
  const fromParam = typeof sp.from === 'string' ? sp.from : undefined
  const toParam = typeof sp.to === 'string' ? sp.to : undefined
  const dateRange = fromParam && toParam ? { from: fromParam, to: toParam } : undefined

  const userDetail = await getUserDetail(id, dateRange)
  if (!userDetail) notFound()

  const { periodBreakdown } = userDetail

  return (
    <PageWrapper title={userDetail.name} backHref="/" backLabel="Kokpit">
      <InfoList
        items={[
          { label: 'Email', value: userDetail.email },
          { label: 'Rola', value: ROLE_LABELS[userDetail.role as RoleT]?.pl ?? userDetail.role },
        ]}
        className="mt-6"
      />

      {/* Saldo + print */}
      <div className="mt-6 flex items-end justify-between">
        <StatCard label="Saldo" value={formatPLN(userDetail.saldo)} />
        <PrintButton />
      </div>

      {/* Period stats */}
      {periodBreakdown && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Zasilenia w okresie" value={formatPLN(periodBreakdown.totalAdvances)} />
          <StatCard label="Wydatki w okresie" value={formatPLN(periodBreakdown.totalExpenses)} />
          <StatCard label="Saldo okresu" value={formatPLN(periodBreakdown.periodSaldo)} />
        </div>
      )}

      {/* Transactions table with filters */}
      <CollapsibleSection title="Transfery" className="mt-8">
        <Suspense fallback={<TransferTableSkeleton />}>
          <TransferTableServer
            where={baseFilters}
            page={page}
            limit={limit}
            excludeColumns={EXCLUDE_COLUMNS}
            baseUrl={`/uzytkownicy/${id}`}
            className="mt-4"
          />
        </Suspense>
      </CollapsibleSection>
    </PageWrapper>
  )
}
