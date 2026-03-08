import { notFound } from 'next/navigation'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { formatPLN } from '@/lib/format-currency'
import { parsePagination } from '@/lib/pagination'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { fetchReferenceData, fetchFilteredByType } from '@/lib/queries/reference-data'
import { deriveWorkerBreakdown } from '@/lib/db/sum-transfers'
import type { HeaderFieldT } from '@/types/export'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { InfoList } from '@/components/ui/info-list'
import { MailtoLink } from '@/components/ui/mailto-link'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InvestmentStats } from '@/components/investments/investment-stats'
import { buildFilterConfig } from '@/lib/build-filter-config'
import { perfStart } from '@/lib/perf'

type UserTransferViewPropsT = {
  readonly userId: string
  readonly searchParams: Record<string, string | string[] | undefined>
  readonly baseUrl: string
  readonly title?: string
  readonly showInfo?: boolean
  readonly excludeColumns?: string[]
}

export async function UserTransferView({
  userId,
  searchParams,
  baseUrl,
  title,
  showInfo = false,
  excludeColumns = ['worker', 'otherCategory', 'invoice'],
}: UserTransferViewPropsT) {
  const step = perfStart()

  const { page, limit } = parsePagination(searchParams)
  const numericId = Number(userId)

  const urlFilters = buildTransferFilters(searchParams, { id: numericId, isManager: false })
  const where = { ...urlFilters, worker: { equals: numericId } }

  const [refData, typeDistribution] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredByType(where),
  ])
  console.log(`[PERF] UserTransferView(${userId}) refData + fetchFilteredByType ${step()}ms`)

  const worker = refData.workers.find((w) => w.id === numericId)
  if (!worker) notFound()

  const { totalAdvances, totalExpenses, periodSaldo } = deriveWorkerBreakdown(typeDistribution)

  const headerFields: HeaderFieldT[] = [
    { label: 'Pracownik', value: worker.name },
    { label: 'Zasilenia', value: formatPLN(totalAdvances), amount: totalAdvances },
    { label: 'Wydatki', value: formatPLN(totalExpenses), amount: -totalExpenses },
    { label: 'Saldo', value: formatPLN(periodSaldo) },
  ]

  return (
    <PageWrapper title={title ?? worker.name}>
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

      <InvestmentStats
        fields={headerFields.filter((f) => f.amount !== undefined || f.label === 'Saldo')}
      />

      <TransfersSection
        config={{
          query: { where, page, limit },
          baseUrl,
          excludeColumns,
          filters: buildFilterConfig(refData, 'workers'),
          context: 'worker',
          contextId: numericId,
          headerFields,
        }}
      />
    </PageWrapper>
  )
}
