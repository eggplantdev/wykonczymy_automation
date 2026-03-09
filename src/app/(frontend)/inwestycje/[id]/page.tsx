import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import {
  fetchReferenceData,
  fetchFilteredByType,
  fetchCategoryBreakdown,
} from '@/lib/queries/reference-data'
import { deriveFinancials } from '@/lib/db/sum-transfers'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { perfStart } from '@/lib/perf'
import { buildFilterConfig } from '@/lib/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { MailtoLink } from '@/components/ui/mailto-link'
import { InvestmentStats } from '@/components/investments/investment-stats'
import { BILANS_LABEL } from '@/lib/export/header-fields'
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
  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })
  const transferWhere = { ...urlFilters, investment: { equals: investmentId } }

  const [refData, typeDistribution, categoryBreakdown] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredByType(transferWhere),
    fetchCategoryBreakdown(transferWhere),
  ])
  console.log(`[PERF] inwestycje/${id} data fetch ${step()}ms`)

  const investment = refData.investments.find((inv) => inv.id === investmentId)
  if (!investment) notFound()

  const { totalMaterialCosts, totalIncome, totalLaborCosts, categoryCosts } = deriveFinancials(
    typeDistribution,
    categoryBreakdown,
  )

  const expenseCatMap = new Map(refData.expenseCategories.map((c) => [c.id, c.name]))

  const headerFields: HeaderFieldT[] = [
    { label: 'Inwestycja', value: investment.name },
    ...categoryCosts.map((cc) => ({
      label: expenseCatMap.get(cc.categoryId) ?? `Kategoria #${cc.categoryId}`,
      value: formatPLN(cc.total),
      amount: -cc.total,
    })),
    {
      label: 'Koszty materiałowe',
      value: formatPLN(totalMaterialCosts),
      amount: -totalMaterialCosts,
    },
    { label: 'Wpłaty od inwestora', value: formatPLN(totalIncome), amount: totalIncome },
    { label: 'Koszty robocizny', value: formatPLN(totalLaborCosts), amount: -totalLaborCosts },
    {
      label: BILANS_LABEL,
      value: formatPLN(totalIncome - totalMaterialCosts - totalLaborCosts),
    },
  ]

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
    <PageWrapper title={investment.name}>
      <InfoList items={infoFields.filter((f) => f.value)} />

      <InvestmentStats
        fields={headerFields.filter((f) => f.amount !== undefined || f.label === BILANS_LABEL)}
      />

      {/* Transactions table */}
      <TransfersSection
        config={{
          query: { where: transferWhere, page, limit },
          baseUrl: `/inwestycje/${id}`,
          excludeColumns: ['investment'],
          filters: buildFilterConfig(refData, 'investments'),
          context: 'investment',
          contextId: investmentId,
          headerFields,
        }}
      />
    </PageWrapper>
  )
}
