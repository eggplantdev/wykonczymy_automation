import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_ROLES } from '@/lib/auth/roles'
import { fetchReferenceData, fetchWorkerBalances } from '@/lib/queries/reference-data'
import { UserDataTable } from '@/components/users/user-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import type { UserRowT } from '@/lib/tables/users'

export default async function UsersListPage() {
  const session = await requireAuth(ADMIN_OR_OWNER_ROLES)
  if (!session.success) redirect('/')

  const [refData, workerBalances] = await Promise.all([fetchReferenceData(), fetchWorkerBalances()])

  const registerMap = new Map(refData.cashRegisters.map((cr) => [cr.id, cr.name]))

  const rows: UserRowT[] = refData.workers.map((worker) => ({
    id: worker.id,
    name: worker.name,
    role: worker.role,
    email: worker.email,
    active: worker.active ?? true,
    defaultCashRegisterName: worker.defaultCashRegisterId
      ? registerMap.get(worker.defaultCashRegisterId)
      : undefined,
    balance: workerBalances[String(worker.id)] ?? 0,
  }))

  return (
    <PageWrapper title="Pracownicy">
      <UserDataTable data={rows} cashRegisters={refData.cashRegisters} />
    </PageWrapper>
  )
}
