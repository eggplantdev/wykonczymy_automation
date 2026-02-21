import { notFound } from 'next/navigation'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { formatPLN } from '@/lib/format-currency'
import { parseDateRange } from '@/lib/parse-date-range'
import { parsePagination } from '@/lib/pagination'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { getUserDetail } from '@/lib/queries/users'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { InfoList } from '@/components/ui/info-list'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PrintButton } from '@/components/ui/print-button'
import { StatCard } from '@/components/ui/stat-card'

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
  const { page, limit } = parsePagination(searchParams)
  const dateRange = parseDateRange(searchParams)

  const userDetail = await getUserDetail(userId, dateRange)
  if (!userDetail) notFound()

  const { periodBreakdown } = userDetail
  const where = buildTransferFilters(searchParams, { id: Number(userId), isManager: false })

  return (
    <PageWrapper
      title={title ?? userDetail.name}
      backHref={backHref}
      backLabel={backLabel}
      className="grid gap-6"
    >
      {showInfo && (
        <InfoList
          items={[
            { label: 'Email', value: userDetail.email },
            { label: 'Rola', value: ROLE_LABELS[userDetail.role as RoleT]?.pl ?? userDetail.role },
          ]}
        />
      )}

      <div className="flex items-end justify-between">
        <StatCard label="Saldo" value={formatPLN(userDetail.saldo)} />
        <PrintButton />
      </div>

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
      />
    </PageWrapper>
  )
}
