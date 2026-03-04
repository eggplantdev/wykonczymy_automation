import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { isAdminOrOwnerRole, MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { fetchReferenceData, fetchRegisterBalances } from '@/lib/queries/reference-data'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { perfStart } from '@/lib/perf'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { StatCard } from '@/components/ui/stat-card'
import type { DynamicPagePropsT } from '@/types/page'

export default async function CashRegisterDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const step = perfStart()
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  // fetch reference data is needed for transfers anyway it will be cached
  // fetch register balances is needed for the balance display - it should be cached from the dashboard hit anyway
  const [refData, balances] = await Promise.all([fetchReferenceData(), fetchRegisterBalances()])
  console.log(`[PERF] kasa/${id} fetchReferenceData + fetchRegisterBalances ${step()}ms`)

  const registerId = Number(id)
  const register = refData.cashRegisters.find((cr) => cr.id === registerId)
  if (!register) notFound()

  const balance = balances[String(id)] ?? 0

  // only admin or owner can view MAIN registers
  if (!isAdminOrOwnerRole(user.role) && register.type === 'MAIN') notFound()

  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })
  const transferWhere = { ...urlFilters, sourceRegister: { equals: registerId } }

  const ownerName = register.ownerId
    ? (refData.workers.find((w) => w.id === register.ownerId)?.name ?? '—')
    : '—'

  return (
    <PageWrapper
      title={register.name}
      backHref="/"
      backLabel="Kokpit"
      className="grid grid-cols-1 gap-6"
    >
      <InfoList items={[{ label: 'Właściciel', value: ownerName }]} />
      <StatCard label="Saldo" value={formatPLN(balance)} />

      {/* Transactions table */}
      <TransfersSection
        query={{ where: transferWhere, page, limit }}
        excludeColumns={['sourceRegister']}
        baseUrl={`/kasa/${id}`}
        filters={{}}
        context="register"
        contextId={registerId}
      />
    </PageWrapper>
  )
}
