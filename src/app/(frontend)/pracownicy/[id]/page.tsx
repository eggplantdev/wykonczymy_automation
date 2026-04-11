import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES, ROLE_LABELS } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { fetchReferenceData, fetchFilteredByType } from '@/lib/queries/reference-data'
import { buildTransferFilters, stripCancelledFilters } from '@/lib/queries/transfers'
import { buildFilterConfig } from '@/lib/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { SaldoDisplay } from '@/components/ui/saldo-display'
import { formatPLN } from '@/lib/format-currency'
import type { HeaderFieldT } from '@/types/export'
import type { DynamicPagePropsT } from '@/types/page'

export default async function UserDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user: currentUser } = session

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const userId = Number(id)
  const urlFilters = buildTransferFilters(sp, { id: currentUser.id })
  const transferWhere = { ...urlFilters, worker: { equals: userId } }

  // Stats ignore cancelled toggle — SQL already excludes cancelled via hardcoded WHERE clause
  const statsWhere = stripCancelledFilters(transferWhere)

  const [refData, typeDistribution] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredByType(statsWhere),
  ])

  const worker = refData.workers.find((w) => w.id === userId)
  if (!worker) notFound()

  const role = worker.type
  const registerName = worker.defaultCashRegisterId
    ? refData.cashRegisters.find((cr) => cr.id === worker.defaultCashRegisterId)?.name
    : undefined

  const infoFields = [
    { label: 'Rola', value: ROLE_LABELS[role].pl },
    { label: 'Email', value: worker.email || '—' },
    { label: 'Status', value: worker.active ? 'Aktywny' : 'Nieaktywny' },
    ...(registerName ? [{ label: 'Domyślna kasa', value: registerName }] : []),
  ]

  const saldo = typeDistribution.find((row) => row.type === 'PAYOUT')?.total ?? 0

  const headerFields: HeaderFieldT[] = [
    { label: 'Pracownik', value: worker.name },
    { label: 'Wypłaty', value: formatPLN(saldo), amount: saldo },
  ]

  return (
    <PageWrapper title={worker.name} backHref="/pracownicy" backLabel="Pracownicy">
      <InfoList items={infoFields} />
      <SaldoDisplay saldo={saldo} label="Wypłaty" />
      <TransfersSection
        config={{
          query: { where: transferWhere, page, limit },
          baseUrl: `/pracownicy/${id}`,
          excludeColumns: ['worker'],
          filters: buildFilterConfig(refData, [
            'users',
            'otherCategories',
            'expenseCategories',
            'type',
          ]),
          headerFields,
        }}
      />
    </PageWrapper>
  )
}
