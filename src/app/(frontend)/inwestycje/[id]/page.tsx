import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { isAdminOrOwnerRole, MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { fetchReferenceData, fetchInvestmentFinancials } from '@/lib/queries/reference-data'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { perfStart } from '@/lib/perf'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { MailtoLink } from '@/components/ui/mailto-link'
import { StatCard } from '@/components/ui/stat-card'
import type { HeaderFieldT } from '@/types/export'
import type { DynamicPagePropsT } from '@/types/page'

export default async function InvestmentDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session

  const step = perfStart()

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const investmentId = Number(id)
  // fetchReferenceData primes the cache for TransferTableServer in Suspense
  const [refData, financialsRecord] = await Promise.all([
    fetchReferenceData(),
    fetchInvestmentFinancials(),
  ])
  console.log(`[PERF] inwestycje/${id} fetchReferenceData + fetchInvestmentFinancials ${step()}ms`)

  const investment = refData.investments.find((inv) => inv.id === investmentId)
  if (!investment) notFound()

  const fin = financialsRecord[String(id)]
  const totalCosts = fin?.totalCosts ?? 0
  const totalIncome = fin?.totalIncome ?? 0
  const totalLaborCosts = fin?.totalLaborCosts ?? 0

  const headerFields: HeaderFieldT[] = [{ label: 'Inwestycja', value: investment.name }]
  if (isAdminOrOwnerRole(user.role)) {
    headerFields.push(
      { label: 'Koszty inwestycji', value: formatPLN(totalCosts) },
      { label: 'Wpłaty od inwestora', value: formatPLN(totalIncome) },
      { label: 'Koszty robocizny', value: formatPLN(totalLaborCosts) },
      {
        label: 'Bilans',
        value: formatPLN(totalIncome - totalCosts - totalLaborCosts),
      },
    )
  }

  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })
  const transferWhere = { ...urlFilters, investment: { equals: investmentId } }

  const infoFields = [
    { label: 'Adres', value: investment.address },
    {
      label: 'Telefon',
      value: investment.phone ? (
        <a href={`tel:${investment.phone}`} className="text-primary hover:underline">
          {investment.phone}
        </a>
      ) : undefined,
    },
    {
      label: 'Email',
      value: investment.email ? <MailtoLink email={investment.email} /> : undefined,
    },
    { label: 'Osoba kontaktowa', value: investment.contactPerson },
    { label: 'Notatki', value: investment.notes },
    { label: 'Status', value: investment.status === 'active' ? 'Aktywna' : 'Zakończona' },
  ]

  return (
    <PageWrapper
      title={investment.name}
      backHref="/"
      backLabel="Pulpit"
      className="grid grid-cols-1 gap-6"
    >
      <InfoList items={infoFields.filter((f) => f.value)} />

      {isAdminOrOwnerRole(user.role) && (
        // do not show these stats to managers =
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Koszty inwestycji" value={formatPLN(totalCosts)} />
          <StatCard label="Wpłaty od inwestora" value={formatPLN(totalIncome)} />
          <StatCard label="Koszty robocizny" value={formatPLN(totalLaborCosts)} />
          <StatCard label="Bilans" value={formatPLN(totalIncome - totalCosts - totalLaborCosts)} />
        </div>
      )}

      {/* Transactions table */}
      <TransfersSection
        config={{
          query: { where: transferWhere, page, limit },
          baseUrl: `/inwestycje/${id}`,
          excludeColumns: ['investment'],
          filters: {},
          context: 'investment',
          contextId: investmentId,
          headerFields,
        }}
      />
    </PageWrapper>
  )
}
