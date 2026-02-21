import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { isAdminOrOwnerRole, MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { getCashRegister } from '@/lib/queries/cash-registers'
import { getRelationName } from '@/lib/get-relation-name'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { InfoList } from '@/components/ui/info-list'
import { StatCard } from '@/components/ui/stat-card'
import type { DynamicPagePropsT } from '@/types/page'

export default async function CashRegisterDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const register = await getCashRegister(id)
  if (!register) notFound()

  // only admin or owner can view MAIN registers
  if (!isAdminOrOwnerRole(user.role) && register.type === 'MAIN') notFound()

  const registerId = Number(id)
  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })
  const transferWhere = { ...urlFilters, cashRegister: { equals: registerId } }

  const ownerName = getRelationName(register.owner)

  return (
    <PageWrapper title={register.name} backHref="/" backLabel="Kokpit" className={`grid gap-6`}>
      <InfoList items={[{ label: 'Właściciel', value: ownerName }]} />
      <StatCard label="Saldo" value={formatPLN(register.balance ?? 0)} />

      {/* Transactions table */}
      <CollapsibleSection title="Transfery">
        <Suspense fallback={<TransferTableSkeleton />}>
          <TransferTableServer
            where={transferWhere}
            page={page}
            limit={limit}
            excludeColumns={['cashRegister']}
            baseUrl={`/kasa/${id}`}
            filters={{}}
            className="mt-4"
          />
        </Suspense>
      </CollapsibleSection>
    </PageWrapper>
  )
}
