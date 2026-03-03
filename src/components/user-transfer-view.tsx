import { notFound } from 'next/navigation'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { formatPLN } from '@/lib/format-currency'
import { parseDateRange } from '@/lib/parse-date-range'
import { parsePagination } from '@/lib/pagination'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { fetchReferenceData, fetchWorkerSaldos } from '@/lib/queries/reference-data'
import { fetchWorkerPeriodBreakdown } from '@/lib/queries/users'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { InfoList } from '@/components/ui/info-list'
import { MailtoLink } from '@/components/ui/mailto-link'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { StatCard } from '@/components/ui/stat-card'
import { perfStart } from '@/lib/perf'

type UserTransferViewPropsT = {
  readonly userId: string
  readonly searchParams: Record<string, string | string[] | undefined>
  readonly baseUrl: string
  readonly title?: string
  readonly backHref?: string
  readonly backLabel?: string
  readonly showInfo?: boolean
  readonly showTypeFilter?: boolean
  readonly excludeColumns?: string[]
}

export async function UserTransferView({
  userId,
  searchParams,
  baseUrl,
  title,
  backHref,
  backLabel,
  showInfo = false,
  showTypeFilter = true,
  excludeColumns = ['worker', 'otherCategory', 'invoice'],
}: UserTransferViewPropsT) {
  const step = perfStart()

  const { page, limit } = parsePagination(searchParams)
  const dateRange = parseDateRange(searchParams)

  // fetchReferenceData + fetchWorkerSaldos are already cached from dashboard
  // periodBreakdown only fetched when user applies a date range filter
  const [refData, saldoRecord, periodBreakdown] = await Promise.all([
    fetchReferenceData(),
    fetchWorkerSaldos(),
    dateRange ? fetchWorkerPeriodBreakdown(userId, dateRange) : Promise.resolve(undefined),
  ])
  console.log(`[PERF] UserTransferView(${userId}) refData + saldos ${step()}ms`)

  const numericId = Number(userId)
  const worker = refData.workers.find((w) => w.id === numericId)
  if (!worker) notFound()

  const saldo = saldoRecord[userId] ?? 0
  const where = buildTransferFilters(searchParams, { id: numericId, isManager: false })

  return (
    <PageWrapper
      title={title ?? worker.name}
      backHref={backHref}
      backLabel={backLabel}
      className="grid grid-cols-1 gap-6"
    >
      {showInfo && (
        <InfoList
          items={[
            {
              label: 'Email',
              value: <MailtoLink email={worker.email} />,
            },
            { label: 'Rola', value: ROLE_LABELS[worker.type as RoleT]?.pl ?? worker.type },
          ]}
        />
      )}

      <StatCard label="Saldo" value={formatPLN(saldo)} />

      {periodBreakdown && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Zasilenia w okresie" value={formatPLN(periodBreakdown.totalAdvances)} />
          <StatCard label="Wydatki w okresie" value={formatPLN(periodBreakdown.totalExpenses)} />
          <StatCard label="Saldo okresu" value={formatPLN(periodBreakdown.periodSaldo)} />
        </div>
      )}

      <TransfersSection
        where={where}
        page={page}
        limit={limit}
        excludeColumns={excludeColumns}
        baseUrl={baseUrl}
        filters={{ showTypeFilter }}
        context="worker"
        contextId={numericId}
      />
    </PageWrapper>
  )
}
