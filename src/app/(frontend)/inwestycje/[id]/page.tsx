import { Suspense } from 'react'
import { Lock } from 'lucide-react'
import { notFound } from 'next/navigation'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { parseInvestmentId } from '@/lib/queries/investment-id'
import { parsePagination } from '@/lib/utils/pagination'
import { parseTransferSort } from '@/lib/queries/transfer-sort'
import {
  fetchInvestmentDetails,
  fetchReferenceData,
  findInvestmentRef,
  withDetails,
} from '@/lib/queries/reference-data'
import { InvestmentSummaryPanel } from '@/components/investments/investment-summary-panel'
import { InvestmentAssetsSection } from '@/components/investments/investment-assets-section'
import { StatsVersionToggle } from '@/components/investments/stats-version-toggle'
import { parseStatsVersion, STATS_VERSION_PARAM } from '@/lib/constants/stats-version'
import { buildTransferFilters, statsWhereFrom } from '@/lib/queries/transfer-filters'
import { perfStart } from '@/lib/perf'
import { buildFilterConfig } from '@/lib/utils/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { InvestmentV1Stats } from '@/components/investments/investment-v1-stats'
import { buildInvestmentInfoFields } from '@/components/investments/investment-info-fields'
import { InvestmentAiNotes } from '@/components/investments/investment-ai-notes'
import { InvestmentNotes } from '@/components/investments/investment-notes'
import { InvestmentStatusInlineSelect } from '@/components/investments/investment-status-inline-select'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { investmentLockOf } from '@/lib/constants/investment-lock'
import { RequestReviewButton } from '@/components/investments/request-review-button'
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

  const [refData, detailsById] = await Promise.all([fetchReferenceData(), fetchInvestmentDetails()])
  console.log(`[PERF] inwestycje/${id} data fetch ${step()}ms`)

  const found = findInvestmentRef(refData, investmentId)
  if (!found) notFound()
  const { trashed } = found
  const investment = withDetails(found.investment, detailsById)

  return (
    <PageWrapper title={investment.name}>
      {trashed && (
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden />
          Inwestycja jest w koszu — tylko do odczytu. Aby ją zmienić, przywróć ją z Kosza.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!trashed && <EditInvestmentDialog investment={investment} showLabel />}
        {investmentLockOf({ status: investment.status, trashed }) === 'completed' && (
          <RequestReviewButton investment={investment} showLabel />
        )}
        {(!trashed || investment.hasSheet) && (
          <SheetButton investmentId={investmentId} hasSheet={investment.hasSheet} size="sm" />
        )}
        <OpenKosztorysV2Button investmentId={investmentId} size="sm" />
      </div>
      {!trashed && <InvestmentStatusInlineSelect investment={investment} />}
      <InfoList
        items={buildInvestmentInfoFields(investment, { isReadOnly: trashed, hideStatus: !trashed })}
      />
      <InvestmentNotes investment={investment} readOnly={trashed} />
      <InvestmentAiNotes aiNotes={investment.aiNotes} />

      <Suspense fallback={null}>
        <InvestmentAssetsSection investmentId={investmentId} />
      </Suspense>

      {/* The two readings render different trees, so a toggle living inside them moves under the
          cursor on every switch. */}
      <div className="w-fit">
        <StatsVersionToggle version={version} />
      </div>

      {version === 'v1' ? (
        <Suspense fallback={null}>
          <InvestmentV1Stats
            statsWhere={statsWhere}
            materialsNetRate={investment.materialsNetRate}
            settlementMode={investment.settlementMode}
            expenseCategories={refData.expenseCategories}
          />
        </Suspense>
      ) : (
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
