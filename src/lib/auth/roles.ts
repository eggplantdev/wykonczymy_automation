import type { PayoutStatusT } from '@/lib/constants/payout-confirmation'

export const ROLES = ['ADMIN', 'OWNER', 'MANAGER', 'EMPLOYEE'] as const
export type RoleT = (typeof ROLES)[number]

export const ROLE_LABELS: Record<RoleT, { en: string; pl: string }> = {
  ADMIN: { en: 'Admin', pl: 'Admin' },
  OWNER: { en: 'Owner', pl: 'Właściciel' },
  MANAGER: { en: 'Manager', pl: 'Manager' },
  EMPLOYEE: { en: 'Employee', pl: 'Pracownik' },
}

// The `: readonly RoleT[]` annotation widens the `as const` tuple:
// it lets `.includes(role)` take any RoleT and lets these pass to the readonly-param guards
// (requireAuth).
export const MANAGEMENT_ROLES: readonly RoleT[] = ['ADMIN', 'OWNER', 'MANAGER'] as const
export const ADMIN_OR_OWNER_ROLES: readonly RoleT[] = ['ADMIN', 'OWNER'] as const
export const ADMIN_OR_OWNER_MANAGER_ROLES: readonly RoleT[] = ['ADMIN', 'OWNER', 'MANAGER'] as const

export const isManagementRole = (role: RoleT): boolean =>
  (MANAGEMENT_ROLES as readonly string[]).includes(role)

export const isAdminOrOwnerRole = (role: RoleT): boolean =>
  (ADMIN_OR_OWNER_ROLES as readonly string[]).includes(role)

export const canBookTransferType = (role: RoleT, type: string): boolean =>
  type !== 'BONUS' || isAdminOrOwnerRole(role)

export const canViewRegister = (role: RoleT, registerType: string | null | undefined): boolean =>
  registerType !== 'MAIN' || isAdminOrOwnerRole(role)

export const canViewWorkerPage = (viewer: { id: number; role: RoleT }, workerId: number): boolean =>
  isManagementRole(viewer.role) || (viewer.role === 'EMPLOYEE' && viewer.id === workerId)

export const BONUS_FORBIDDEN_MESSAGE = 'Premię może przyznać tylko właściciel lub administrator.'

export const canManageAccount = (actorRole: RoleT, targetRole: RoleT): boolean =>
  actorRole !== 'MANAGER' || targetRole === 'EMPLOYEE'

export const assignableRoles = (actorRole: RoleT, currentRole?: RoleT): RoleT[] =>
  ROLES.filter(
    (role) =>
      role === currentRole ||
      (canManageAccount(actorRole, role) &&
        (currentRole === undefined || canManageAccount(actorRole, currentRole))),
  )

type AccountT = { id: number; role: RoleT }

export const canTrashAccount = (actor: AccountT, target: AccountT): boolean =>
  actor.id !== target.id && canManageAccount(actor.role, target.role)

export type RegisterScopeT = {
  type: string | null | undefined
  ownerId?: number
  ownerRole?: RoleT
}

export const canManageRegister = (actor: AccountT, register: RegisterScopeT): boolean =>
  isAdminOrOwnerRole(actor.role) ||
  (canViewRegister(actor.role, register.type) &&
    (register.ownerId === actor.id ||
      (register.ownerRole !== undefined && canManageAccount(actor.role, register.ownerRole))))

type CanMutateTransferArgsT = {
  role: RoleT
  userId: number
  transferType: string
  createdById: number | null | undefined
}

export const canMutateTransfer = ({
  role,
  userId,
  transferType,
  createdById,
}: CanMutateTransferArgsT): boolean => {
  if (isAdminOrOwnerRole(role)) return true
  if (createdById === userId) return true
  if (transferType === 'LABOR_COST' && isManagementRole(role)) return true
  return false
}

type CanCancelTransferArgsT = CanMutateTransferArgsT & {
  payoutStatus: PayoutStatusT | null | undefined
}

// A wypłata the worker rejected sits in every manager's dashboard queue, so whoever picks it up must
// be able to cancel it — editing it stays with the author.
export const canCancelTransfer = ({ payoutStatus, ...args }: CanCancelTransferArgsT): boolean =>
  canMutateTransfer(args) || (payoutStatus === 'rejected' && isManagementRole(args.role))
