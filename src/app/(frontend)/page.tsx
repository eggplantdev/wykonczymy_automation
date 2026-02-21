import { requireAuth } from '@/lib/auth/require-auth'
import { isManagementRole, ROLES } from '@/lib/auth/roles'
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard'
import { UserTransferView } from '@/components/user-transfer-view'
import { redirect } from 'next/navigation'
import type { PagePropsT } from '@/types/page'

const EMPLOYEE_EXCLUDE_COLUMNS = [
  'type',
  'cashRegister',
  'worker',
  'otherCategory',
  'invoice',
  'paymentMethod',
]

export default async function DashboardPage({ searchParams }: PagePropsT) {
  const session = await requireAuth(ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session
  const params = await searchParams

  if (isManagementRole(user.role)) return <ManagerDashboard searchParams={params} />

  return (
    <UserTransferView
      userId={String(user.id)}
      title="Moje konto"
      searchParams={params}
      baseUrl="/"
      excludeColumns={EMPLOYEE_EXCLUDE_COLUMNS}
      showTypeFilter={false}
    />
  )
}
