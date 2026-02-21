import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { getInvestment } from '@/lib/queries/investments'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { InfoList } from '@/components/ui/info-list'
import { StatCard } from '@/components/ui/stat-card'
import type { DynamicPagePropsT } from '@/types/page'

export default async function InvestmentDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')
  if (!isManagementRole(user.role)) redirect('/')
  const isOwnerOrAdmin = user.role === 'ADMIN' || user.role === 'OWNER'

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const investmentId = Number(id)
  const investment = await getInvestment(id)
  if (!investment) notFound()

  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })
  const transferWhere = { ...urlFilters, investment: { equals: investmentId } }

  const infoFields = [
    { label: 'Adres', value: investment.address },
    { label: 'Telefon', value: investment.phone },
    { label: 'Email', value: investment.email },
    { label: 'Osoba kontaktowa', value: investment.contactPerson },
    { label: 'Notatki', value: investment.notes },
    { label: 'Status', value: investment.status === 'active' ? 'Aktywna' : 'Zakończona' },
  ]

  return (
    <PageWrapper title={investment.name} backHref="/" backLabel="Kokpit">
      <InfoList items={infoFields.filter((f) => f.value)} className="mt-6" />

      {isOwnerOrAdmin && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Koszty inwestycji" value={formatPLN(investment.totalCosts ?? 0)} />
          <StatCard label="Wpłaty od inwestora" value={formatPLN(investment.totalIncome ?? 0)} />
          <StatCard label="Koszty robocizny" value={formatPLN(investment.laborCosts ?? 0)} />
          <StatCard
            label="Bilans"
            value={formatPLN(
              (investment.totalIncome ?? 0) -
                (investment.totalCosts ?? 0) -
                (investment.laborCosts ?? 0),
            )}
          />
        </div>
      )}

      {/* Transactions table */}
      <CollapsibleSection title="Transfery" className="mt-8">
        <div className="mt-4">
          <Suspense fallback={<TransferTableSkeleton />}>
            <TransferTableServer
              where={transferWhere}
              page={page}
              limit={limit}
              excludeColumns={['investment']}
              baseUrl={`/inwestycje/${id}`}
              filters={{}}
            />
          </Suspense>
        </div>
      </CollapsibleSection>
    </PageWrapper>
  )
}
