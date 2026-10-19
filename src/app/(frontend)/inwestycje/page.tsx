import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES, isAdminOrOwnerRole } from '@/lib/auth/roles'
import { fetchAllInvestments } from '@/lib/queries/investments'
import { getPresets } from '@/lib/queries/presets'
import { fetchOrderSettings } from '@/lib/queries/order-settings'
import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import { OrderSettingsCard } from '@/components/orders/order-settings-card'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'

export default async function InvestmentsPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const [investments, presets, orderSettings] = await Promise.all([
    fetchAllInvestments(),
    getPresets(),
    fetchOrderSettings(),
  ])

  return (
    <PageWrapper title={PAGE_TITLES.investments}>
      <OrderSettingsCard
        settings={orderSettings}
        canEdit={isAdminOrOwnerRole(session.user.role)}
      />
      <InvestmentDataTable data={investments} presets={presets} />
    </PageWrapper>
  )
}
