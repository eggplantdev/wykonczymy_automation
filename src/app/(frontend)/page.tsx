import { requireAuth } from '@/lib/auth/require-auth'
import { isManagementRole, ROLES } from '@/lib/auth/roles'
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard'
import { EmployeeDashboardServer } from '@/components/dashboard/employee-dashboard-server'
import { redirect } from 'next/navigation'
import type { PagePropsT } from '@/types/page'

export default async function DashboardPage({ searchParams }: PagePropsT) {
  const session = await requireAuth(ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session
  const params = await searchParams

  if (isManagementRole(user.role)) return <ManagerDashboard searchParams={params} />

  return <EmployeeDashboardServer userId={user.id} searchParams={params} />
}
