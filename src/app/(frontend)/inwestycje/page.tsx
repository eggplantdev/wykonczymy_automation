import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchAllInvestments } from '@/lib/queries/investments'
import { getPresets } from '@/lib/queries/presets'
import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'

export default async function InvestmentsPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const [investments, presets] = await Promise.all([fetchAllInvestments(), getPresets()])

  return (
    <PageWrapper title={PAGE_TITLES.investments}>
      <InvestmentDataTable data={investments} presets={presets} />
    </PageWrapper>
  )
}
