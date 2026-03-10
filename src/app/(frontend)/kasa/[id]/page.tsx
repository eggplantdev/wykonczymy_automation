import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { isAdminOrOwnerRole, isManagementRole, ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { fetchReferenceData, fetchRegisterBalances } from '@/lib/queries/reference-data'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { perfStart } from '@/lib/perf'
import { buildFilterConfig } from '@/lib/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { StatCard } from '@/components/ui/stat-card'
import type { Where } from 'payload'
import type { HeaderFieldT } from '@/types/export'
import type { DynamicPagePropsT } from '@/types/page'

export default async function CashRegisterDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const step = perfStart()
  const session = await requireAuth(ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session
  const isManager = isManagementRole(user.role)

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const registerId = Number(id)
  // Strip sourceRegister from URL params — the page already scopes to this
  // register via its own OR clause. Passing it through would collide (both
  // produce `where.or`).
  const { sourceRegister: _, ...filteredSp } = sp
  const urlFilters = buildTransferFilters(filteredSp, { id: user.id, isManager })
  const transferWhere: Where = {
    ...urlFilters,
    or: [{ sourceRegister: { equals: registerId } }, { targetRegister: { equals: registerId } }],
  }

  const [refData, balanceRecord] = await Promise.all([
    fetchReferenceData(),
    fetchRegisterBalances(),
  ])
  console.log(`[PERF] kasa/${id} fetchReferenceData + fetchRegisterBalances ${step()}ms`)

  const register = refData.cashRegisters.find((cr) => cr.id === registerId)
  if (!register) notFound()

  const saldo = balanceRecord[String(registerId)] ?? 0

  // only admin or owner can view MAIN registers
  if (!isAdminOrOwnerRole(user.role) && register.type === 'MAIN') notFound()

  // employees can only view their own registers
  if (!isManager && register.ownerId !== user.id) notFound()

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
