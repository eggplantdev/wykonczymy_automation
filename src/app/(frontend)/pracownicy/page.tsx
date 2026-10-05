import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_MANAGER_ROLES, canTrashAccount } from '@/lib/auth/roles'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchWorkerPayoutPairs } from '@/lib/queries/balances'
import { workerColumnFigures } from '@/lib/kosztorys/worker-payout-pairs'
import { ownedRegisters } from '@/lib/workers/owned-registers'
import { UserDataTable } from '@/components/users/user-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'
import type { UserRowT } from '@/types/table-rows'

export default async function UsersListPage() {
  const session = await requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)
  if (!session.success) redirect('/')

  const [refData, pairs] = await Promise.all([fetchReferenceData(), fetchWorkerPayoutPairs()])
  const figuresByWorker = workerColumnFigures(pairs)

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
    payoutRemaining: figuresByWorker.get(worker.id),
    registerNames: ownedRegisters(refData.cashRegisters, worker.id).map(
      (register) => register.name,
    ),
    canTrash: canTrashAccount(session.user, worker),
  }))

  return (
    <PageWrapper title={PAGE_TITLES.employees}>
      <UserDataTable data={rows} cashRegisters={refData.cashRegisters} />
    </PageWrapper>
  )
}
