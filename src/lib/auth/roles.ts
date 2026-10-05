export const ROLES = ['ADMIN', 'OWNER', 'MANAGER', 'EMPLOYEE'] as const
export type RoleT = (typeof ROLES)[number]

export const ROLE_LABELS: Record<RoleT, { en: string; pl: string }> = {
  ADMIN: { en: 'Admin', pl: 'Admin' },
  OWNER: { en: 'Owner', pl: 'Właściciel' },
  MANAGER: { en: 'Manager', pl: 'Manager' },
  EMPLOYEE: { en: 'Employee', pl: 'Pracownik' },
}

// The `: readonly RoleT[]` annotation widens the `as const` tuple — load-bearing, not noise:
// it lets `.includes(role)` take any RoleT and lets these pass to the readonly-param guards
// (requireAuth). Without it the bare tuple narrows both and breaks every call site.
export const MANAGEMENT_ROLES: readonly RoleT[] = ['ADMIN', 'OWNER', 'MANAGER'] as const
export const ADMIN_OR_OWNER_ROLES: readonly RoleT[] = ['ADMIN', 'OWNER'] as const
export const ADMIN_OR_OWNER_MANAGER_ROLES: readonly RoleT[] = ['ADMIN', 'OWNER', 'MANAGER'] as const

export const isManagementRole = (role: RoleT): boolean =>
  (MANAGEMENT_ROLES as readonly string[]).includes(role)

export const isAdminOrOwnerRole = (role: RoleT): boolean =>
  (ADMIN_OR_OWNER_ROLES as readonly string[]).includes(role)

// Owner ruling (EX-979): only ADMIN / OWNER grant a premia; a MANAGER books every other type.
export const canBookTransferType = (role: RoleT, type: string): boolean =>
  type !== 'BONUS' || isAdminOrOwnerRole(role)

// Below OWNER the main kasa is not listed, opened or trashed.
export const canViewRegister = (role: RoleT, registerType: string | null | undefined): boolean =>
  registerType !== 'MAIN' || isAdminOrOwnerRole(role)

export const canViewWorkerPage = (viewer: { id: number; role: RoleT }, workerId: number): boolean =>
  isManagementRole(viewer.role) || (viewer.role === 'EMPLOYEE' && viewer.id === workerId)

export const BONUS_FORBIDDEN_MESSAGE = 'Premię może przyznać tylko właściciel lub administrator.'

/** A MANAGER manages EMPLOYEE accounts only; anyone above answers to him as missing (EX-918). */
export const canManageAccount = (actorRole: RoleT, targetRole: RoleT): boolean =>
  actorRole !== 'MANAGER' || targetRole === 'EMPLOYEE'

type AccountT = { id: number; role: RoleT }

// Offered only where the trash action would not refuse on the actor alone — the last-OWNER and
// used-account refusals need the DB and stay the action's to say.
export const canTrashAccount = (actor: AccountT, target: AccountT): boolean =>
  actor.id !== target.id && canManageAccount(actor.role, target.role)

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
