import type { RoleT } from '@/lib/auth/roles'
import { isManagementRole } from '@/lib/auth/permissions'
import { getUserCashRegisterIds } from '@/lib/auth/get-user-cash-registers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { TopNav } from '@/components/nav/top-nav'

type NavigationPropsT = {
  user: {
    id: number
    name: string
    email: string
    role: RoleT
  }
}

export async function Navigation({ user }: NavigationPropsT) {
  const isManager = isManagementRole(user.role)

  const [referenceData, managerRegisterIds] = await Promise.all([
    isManager ? fetchReferenceData() : undefined,
    getUserCashRegisterIds(user.id, user.role),
  ])

  const managerCashRegisterId = managerRegisterIds?.[0]

  const filteredRefData = referenceData
    ? {
        ...referenceData,
        cashRegisters:
          user.role === 'ADMIN' || user.role === 'OWNER'
            ? referenceData.cashRegisters
            : referenceData.cashRegisters.filter((cr) => cr.type === 'AUXILIARY'),
      }
    : undefined

  return (
    <TopNav
      referenceData={filteredRefData}
      managerCashRegisterId={managerCashRegisterId}
      user={user}
    />
  )
}
