import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { fetchReferenceData, fetchFilteredFinancials } from '@/lib/queries/reference-data'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { formatPLN } from '@/lib/format-currency'
import { perfStart } from '@/lib/perf'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InvestmentStats } from '@/components/investments/investment-stats'
import { BILANS_LABEL } from '@/lib/export/header-fields'
import type { HeaderFieldT } from '@/types/export'
import type { PagePropsT } from '@/types/page'

export default async function TransactionsReportPage({ searchParams }: PagePropsT) {
  const session = await requireAuth(ADMIN_OR_OWNER_ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session

  const step = perfStart()

  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const urlFilters = buildTransferFilters(sp, { id: user.id, isManager: true })

  const [refData, financials] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredFinancials(urlFilters),
  ])
  console.log(`[PERF] transakcje fetchReferenceData + fetchFilteredFinancials ${step()}ms`)

  const { totalCosts, totalIncome, totalLaborCosts } = financials

  const headerFields: HeaderFieldT[] = [
    { label: 'Transakcje', value: 'Raport' },
    { label: 'Koszty', value: formatPLN(totalCosts), amount: -totalCosts },
    { label: 'Wpływy', value: formatPLN(totalIncome), amount: totalIncome },
    { label: 'Koszty robocizny', value: formatPLN(totalLaborCosts), amount: -totalLaborCosts },
    {
      label: BILANS_LABEL,
      value: formatPLN(totalIncome - totalCosts - totalLaborCosts),
    },
  ]

  return (
    <PageWrapper title="Raporty">
      <InvestmentStats
        fields={headerFields.filter((f) => f.amount !== undefined || f.label === BILANS_LABEL)}
      />

      <TransfersSection
        config={{
          query: { where: urlFilters, page, limit },
          baseUrl: '/raporty',
          filters: {
            cashRegisters: refData.cashRegisters.map((c) => ({ id: c.id, name: c.name })),
            investments: refData.investments.map((i) => ({ id: i.id, name: i.name })),
            users: refData.workers.map((w) => ({ id: w.id, name: w.name })),
            workers: refData.workers.map((w) => ({ id: w.id, name: w.name })),
            otherCategories: refData.otherCategories.map((c) => ({ id: c.id, name: c.name })),
            showPaymentMethodFilter: true,
          },
          headerFields,
        }}
      />
    </PageWrapper>
  )
}
