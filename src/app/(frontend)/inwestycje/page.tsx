import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES, isAdminOrOwnerRole } from '@/lib/auth/roles'
import { fetchAllInvestments } from '@/lib/queries/investments'
import { getPresets } from '@/lib/queries/presets'
import { fetchOrderSettings } from '@/lib/queries/order-settings'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import { OrderSettingsCard } from '@/components/orders/order-settings-card'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'

export default async function InvestmentsPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const [investments, presets, orderSettings, referenceDataBase] = await Promise.all([
    fetchAllInvestments(),
    getPresets(),
    fetchOrderSettings(),
    fetchReferenceData(),
  ])
  const { user } = session

  return (
    <PageWrapper title={PAGE_TITLES.investments}>
      <OrderSettingsCard
        settings={orderSettings}
        canEdit={isAdminOrOwnerRole(user.role)}
      />
      <InvestmentDataTable
        data={investments}
        presets={presets}
        referenceData={{ ...referenceDataBase, currentUserId: user.id, currentUserRole: user.role }}
        orderSettings={orderSettings}
      />
    </PageWrapper>
  )
}
