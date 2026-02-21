import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { getCashRegister } from '@/lib/queries/cash-registers'
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

  // Block MANAGER from viewing MAIN registers
  if (user.role === 'MANAGER' && register.type === 'MAIN') notFound()

  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })
  const transferWhere = { ...urlFilters, cashRegister: { equals: id } }

  const ownerName =
    typeof register.owner === 'object' && register.owner !== null ? register.owner.name : '—'

  return (
    <PageWrapper title={register.name} backHref="/" backLabel="Kokpit">
      <InfoList items={[{ label: 'Właściciel', value: ownerName }]} className="mt-6" />

      <StatCard label="Saldo" value={formatPLN(register.balance ?? 0)} className="mt-6" />

      {/* Transactions table */}
      <CollapsibleSection title="Transfery" className="mt-8">
        <div className="mt-4">
          <Suspense fallback={<TransferTableSkeleton />}>
            <TransferTableServer
              where={transferWhere}
              page={page}
              limit={limit}
              excludeColumns={['cashRegister']}
              baseUrl={`/kasa/${id}`}
              filters={{}}
            />
          </Suspense>
        </div>
      </CollapsibleSection>
    </PageWrapper>
  )
}
