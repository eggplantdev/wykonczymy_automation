import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { getCashRegister } from '@/lib/queries/cash-registers'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { StatCard } from '@/components/ui/stat-card'

type PagePropsT = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CashRegisterDetailPage({ params, searchParams }: PagePropsT) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')

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
      {/* Info section */}
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground font-medium">Właściciel</dt>
        <dd className="text-foreground">{ownerName}</dd>
      </dl>

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
