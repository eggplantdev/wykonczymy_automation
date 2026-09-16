import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { parseInvestmentId } from '@/lib/queries/investment-id'
import { parsePagination } from '@/lib/utils/pagination'
import { parseTransferSort } from '@/lib/queries/transfer-sort'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchFilteredByType, fetchCategoryBreakdowns } from '@/lib/queries/transfer-totals'
import { deriveFinancials } from '@/lib/db/investment-financials'
import { calculateMargin } from '@/lib/db/calculate-margin'
import { InvestmentSummaryPanel } from '@/components/investments/investment-summary-panel'
import { StatsVersionToggle } from '@/components/investments/stats-version-toggle'
import { parseStatsVersion, STATS_VERSION_PARAM } from '@/lib/constants/stats-version'
import { buildTransferFilters, statsWhereFrom } from '@/lib/queries/transfer-filters'
import { buildFinancialFields, buildSettledFields } from '@/lib/queries/investment-financial-fields'
import { perfStart } from '@/lib/perf'
import { buildFilterConfig } from '@/lib/utils/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { ContactLink } from '@/components/ui/contact-link'
import { FinancialStats } from '@/components/investments/financial-stats'
import { STATUS_LABELS } from '@/components/investments/investment-status-badge'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { SheetButton } from '@/components/dialogs/sheet-button'
import { OpenKosztorysV2Button } from '@/components/kosztorys/open-kosztorys-v2-button'
import type { DynamicPagePropsT } from '@/types/page'

export default async function InvestmentDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const user = await requireManagementPage()

  const step = perfStart()

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)
  const sort = parseTransferSort(sp)

  const investmentId = parseInvestmentId(id)
  const urlFilters = buildTransferFilters(sp, { id: user.id })
  const transferWhere = { ...urlFilters, investment: { equals: investmentId } }

  const statsWhere = statsWhereFrom(transferWhere)

  const version = parseStatsVersion(sp[STATS_VERSION_PARAM])

  const [refData, typeDistribution, breakdowns] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredByType(statsWhere),
    fetchCategoryBreakdowns(statsWhere),
  ])
  console.log(`[PERF] inwestycje/${id} data fetch ${step()}ms`)

  const investment = refData.investments.find((inv) => inv.id === investmentId)
  if (!investment) notFound()

  const financials = deriveFinancials(
    typeDistribution,
    breakdowns.categoryCosts,
    breakdowns.settledCategoryCosts,
    investment.materialsNetRate,
    investment.settlementMode,
    breakdowns.netCategoryCosts,
  )

  const financialFields = buildFinancialFields(financials, refData.expenseCategories)
  const settledFields = buildSettledFields(
    financials.settledCategoryCosts,
    refData.expenseCategories,
  )
  const infoFields = [
    { label: 'Adres', value: investment.address },
    { label: 'Telefon', value: <ContactLink type="phone" value={investment.phone} /> },
    { label: 'Email', value: <ContactLink type="email" value={investment.email} /> },
    { label: 'Osoba kontaktowa', value: investment.contactPerson },
    { label: 'Notatki', value: investment.notes },
    { label: 'Opinia', value: investment.review || '—' },
    { label: 'Status', value: STATUS_LABELS[investment.status] },
  ]

  return (
    <PageWrapper title={investment.name}>
      <div className="flex flex-wrap items-center gap-2">
        <EditInvestmentDialog investment={investment} showLabel />
        <SheetButton investmentId={investmentId} hasSheet={investment.hasSheet} />
        <OpenKosztorysV2Button investmentId={investmentId} />
      </div>
      <InfoList items={infoFields.filter((f) => f.value)} />

      {/* Anchored here rather than inside either reading's block: the two readings render different
          trees, so a toggle living inside them moves under the cursor on every switch. */}
      <div className="w-fit">
        <StatsVersionToggle version={version} />
      </div>

      {version === 'v1' ? (
        <FinancialStats
          fields={financialFields}
          margin={calculateMargin(financials)}
          totalPayouts={financials.totalPayouts}
          settledFields={settledFields}
        />
      ) : (
        // Streamed off the critical path: the panel owns the kosztorys tree fetch, the page's
        // long-pole query, so the rest of the page paints without waiting on it.
        <Suspense fallback={null}>
          <InvestmentSummaryPanel
            investmentId={investmentId}
            investmentName={investment.name}
            canSeeMargin={isAdminOrOwnerRole(user.role)}
            expenseCategories={refData.expenseCategories}
          />
        </Suspense>
      )}

      <TransfersSection
        title="Transfery"
        config={{
          query: { where: transferWhere, page, limit, sort },
          baseUrl: `/inwestycje/${id}`,
          excludeColumns: ['investment'],
          filters: buildFilterConfig(refData, 'investments'),
          invoiceDownload: true,
          print: true,
          cancelledTransactionAudit: sp.cancelledTransactionAudit === '1',
        }}
      />
    </PageWrapper>
  )
}
