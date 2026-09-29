import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchAllInvestments } from '@/lib/queries/investments'
import { getPresets } from '@/lib/queries/presets'
import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'

export default async function InvestmentsPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const [investments, presets] = await Promise.all([fetchAllInvestments(), getPresets()])
  const activeCount = investments.filter((i) => i.status === 'active').length

  return (
    <PageWrapper title={PAGE_TITLES.investments}>
      <Description>{activeCount} aktywnych</Description>
      <InvestmentDataTable data={investments} presets={presets} />
    </PageWrapper>
  )
}
