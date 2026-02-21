export const ROLES = ['ADMIN', 'OWNER', 'MANAGER', 'EMPLOYEE'] as const
export type RoleT = (typeof ROLES)[number]

export const ROLE_LABELS: Record<RoleT, { en: string; pl: string }> = {
  ADMIN: { en: 'Admin', pl: 'Admin' },
  OWNER: { en: 'Owner', pl: 'Właściciel' },
  MANAGER: { en: 'Manager', pl: 'Manager' },
  EMPLOYEE: { en: 'Employee', pl: 'Pracownik' },
}

export const MANAGEMENT_ROLES: readonly RoleT[] = ['ADMIN', 'OWNER', 'MANAGER'] as const
export const ADMIN_OR_OWNER_ROLES: readonly RoleT[] = ['ADMIN', 'OWNER'] as const

export const isManagementRole = (role: RoleT): boolean =>
  (MANAGEMENT_ROLES as readonly string[]).includes(role)

export const isAdminOrOwnerRole = (role: RoleT): boolean =>
  (ADMIN_OR_OWNER_ROLES as readonly string[]).includes(role)
