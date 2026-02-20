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

  const [referenceData, userRegisterIds] = await Promise.all([
    isManager ? fetchReferenceData() : undefined,
    getUserCashRegisterIds(user.id, user.role),
  ])

  return <TopNav referenceData={referenceData} userCashRegisterIds={userRegisterIds} />
}
