import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES, type RoleT } from '@/lib/auth/roles'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { UserDataTable } from '@/components/users/user-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import type { UserRowT } from '@/lib/tables/users'

export default async function UsersListPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')

  const refData = await fetchReferenceData()

  const registerMap = new Map(refData.cashRegisters.map((cr) => [cr.id, cr.name]))

  const rows: UserRowT[] = refData.workers.map((worker) => ({
    id: worker.id,
    name: worker.name,
    role: (worker.type ?? 'EMPLOYEE') as RoleT,
    email: worker.email,
    active: worker.active ?? true,
    defaultCashRegisterName: worker.defaultCashRegisterId
      ? registerMap.get(worker.defaultCashRegisterId)
      : undefined,
  }))

  return (
    <PageWrapper title="Pracownicy" backHref="/" backLabel="Pulpit">
      <UserDataTable data={rows} />
    </PageWrapper>
  )
}
