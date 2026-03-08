import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { isAdminOrOwnerRole, MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { fetchReferenceData, fetchFilteredByType } from '@/lib/queries/reference-data'
import { deriveFinancials } from '@/lib/db/sum-transfers'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { perfStart } from '@/lib/perf'
import { buildFilterConfig } from '@/lib/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { StatCard } from '@/components/ui/stat-card'
import type { HeaderFieldT } from '@/types/export'
import type { DynamicPagePropsT } from '@/types/page'

export default async function CashRegisterDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const step = perfStart()
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const registerId = Number(id)
  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })
  const transferWhere = { ...urlFilters, sourceRegister: { equals: registerId } }

  const [refData, typeDistribution] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredByType(transferWhere),
  ])
  console.log(`[PERF] kasa/${id} fetchReferenceData + fetchFilteredByType ${step()}ms`)

  const register = refData.cashRegisters.find((cr) => cr.id === registerId)
  if (!register) notFound()

  const { totalCosts, totalIncome, totalLaborCosts } = deriveFinancials(typeDistribution)
  const saldo = totalIncome - totalCosts - totalLaborCosts

  // only admin or owner can view MAIN registers
  if (!isAdminOrOwnerRole(user.role) && register.type === 'MAIN') notFound()

  const ownerName = register.ownerId
    ? (refData.workers.find((w) => w.id === register.ownerId)?.name ?? '—')
    : '—'

  const headerFields: HeaderFieldT[] = [
    { label: 'Kasa', value: register.name },
    { label: 'Właściciel', value: ownerName },
    { label: 'Saldo', value: formatPLN(saldo) },
  ]

  return (
    <PageWrapper title={register.name}>
      <InfoList items={[{ label: 'Właściciel', value: ownerName }]} />
      <StatCard label="Saldo" value={formatPLN(saldo)} className="w-fit" />

      {/* Transactions table */}
      <TransfersSection
        config={{
          query: { where: transferWhere, page, limit },
          baseUrl: `/kasa/${id}`,
          excludeColumns: ['sourceRegister'],
          filters: buildFilterConfig(refData, 'cashRegisters'),
          context: 'register',
          contextId: registerId,
          headerFields,
        }}
      />
    </PageWrapper>
  )
}
