import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchAllInvestments } from '@/lib/queries/investments'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function InvestmentsPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const [investments, refData] = await Promise.all([fetchAllInvestments(), fetchReferenceData()])
  const activeCount = investments.filter((i) => i.status === 'active').length

  return (
    <PageWrapper title="Inwestycje">
      <Description>{activeCount} aktywnych</Description>
      <InvestmentDataTable data={investments} expenseCategories={refData.expenseCategories} />
    </PageWrapper>
  )
}
