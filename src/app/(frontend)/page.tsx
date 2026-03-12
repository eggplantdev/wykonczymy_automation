import { requireAuth } from '@/lib/auth/require-auth'
import { isManagementRole, ROLES } from '@/lib/auth/roles'
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard'
import { notFound, redirect } from 'next/navigation'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import type { PagePropsT } from '@/types/page'

export default async function DashboardPage({ searchParams }: PagePropsT) {
  const session = await requireAuth(ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session
  const params = await searchParams

  if (isManagementRole(user.role))
    return <ManagerDashboard searchParams={params} currentUserName={user.name} />

  // Employee — redirect to their WORKER register
  const refData = await fetchReferenceData()
  const workerRegister = refData.cashRegisters.find(
    (cr) => cr.type === 'WORKER' && cr.ownerId === user.id,
  )

  if (workerRegister) redirect(`/kasa/${workerRegister.id}`)

  // Employee has no WORKER register — admin needs to set one up
  notFound()
}
