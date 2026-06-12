import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import {
  fetchReferenceData,
  fetchFilteredByType,
  fetchCategoryBreakdown,
  fetchSettledCategoryBreakdown,
} from '@/lib/queries/reference-data'
import { deriveFinancials } from '@/lib/db/sum-transfers'
import { buildTransferFilters, stripCancelledFilters } from '@/lib/queries/transfers'
import { buildFinancialFields, buildSettledFields } from '@/lib/map-category-costs'
import { perfStart } from '@/lib/perf'
import { buildFilterConfig } from '@/lib/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { ContactLink } from '@/components/ui/contact-link'
import { FinancialStats } from '@/components/investments/financial-stats'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { SheetButton } from '@/components/dialogs/sheet-button'
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
  const urlFilters = buildTransferFilters(sp, { id: user.id })
  const transferWhere = { ...urlFilters, investment: { equals: investmentId } }

  // Stats ignore cancelled toggle — SQL already excludes cancelled via hardcoded WHERE clause
  const statsWhere = stripCancelledFilters(transferWhere)

  const [refData, typeDistribution, categoryBreakdown, settledBreakdown] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredByType(statsWhere),
    fetchCategoryBreakdown(statsWhere),
    fetchSettledCategoryBreakdown(statsWhere),
  ])
  console.log(`[PERF] inwestycje/${id} data fetch ${step()}ms`)

  const investment = refData.investments.find((inv) => inv.id === investmentId)
  if (!investment) notFound()

  const financials = deriveFinancials(typeDistribution, categoryBreakdown, settledBreakdown)

  const financialFields = buildFinancialFields(financials, refData.expenseCategories)
  const settledFields = buildSettledFields(
    financials.settledCategoryCosts,
    refData.expenseCategories,
  )
  const headerFields: HeaderFieldT[] = [
    { label: 'Inwestycja', value: investment.name },
    ...financialFields,
  ]

  const infoFields = [
    { label: 'Adres', value: investment.address },
    { label: 'Telefon', value: <ContactLink type="phone" value={investment.phone} /> },
    { label: 'Email', value: <ContactLink type="email" value={investment.email} /> },
    { label: 'Osoba kontaktowa', value: investment.contactPerson },
    { label: 'Notatki', value: investment.notes },
    { label: 'Opinia', value: investment.review || '—' },
    { label: 'Status', value: investment.status === 'active' ? 'Aktywna' : 'Zakończona' },
  ]

  return (
    <PageWrapper title={investment.name}>
      <div className="flex flex-wrap items-center gap-2">
        <EditInvestmentDialog investment={investment} />
        <SheetButton
          investmentId={investmentId}
          investmentName={investment.name}
          hasSheet={investment.hasSheet}
        />
      </div>
      <InfoList items={infoFields.filter((f) => f.value)} />

      <FinancialStats
        fields={financialFields}
        totalLaborCosts={financials.totalLaborCosts}
        totalPayouts={financials.totalPayouts}
        totalRabat={financials.totalRabat}
        totalLoss={financials.totalLoss}
        settledFields={settledFields}
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
          totalPayouts: financials.totalPayouts,
          cancelledTransactionAudit: sp.cancelledTransactionAudit === '1',
        }}
      />
    </PageWrapper>
  )
}
