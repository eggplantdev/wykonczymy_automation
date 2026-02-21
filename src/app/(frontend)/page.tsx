import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { isManagementRole } from '@/lib/auth/roles'
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard'
import { EmployeeDashboardServer } from '@/components/dashboard/employee-dashboard-server'
import { redirect } from 'next/navigation'
import type { PagePropsT } from '@/types/page'

export default async function DashboardPage({ searchParams }: PagePropsT) {
  const user = await getCurrentUserJwt()
  if (!user) redirect('/zaloguj')
  const params = await searchParams

  if (isManagementRole(user.role)) return <ManagerDashboard searchParams={params} />

  return <EmployeeDashboardServer userId={user.id} searchParams={params} />
}
