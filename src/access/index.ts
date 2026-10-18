import type { Access, FieldAccess, PayloadRequest } from 'payload'
import type { RoleT } from '@/lib/auth/roles'

type UserWithRole =
  | {
      id: number
      role?: RoleT
    }
  | null
  | undefined

const hasRole = (user: UserWithRole, role: RoleT): boolean => user?.role === role

export const hasAnyRole = (user: UserWithRole, ...roles: RoleT[]): boolean =>
  roles.some((role) => hasRole(user, role))

type BooleanAccess = ({ req }: { req: PayloadRequest }) => boolean

export const isAdminOrOwnerOrManagerBoolean: BooleanAccess = ({ req: { user } }) =>
  hasAnyRole(user, 'ADMIN', 'OWNER', 'MANAGER')

export const isAuthenticatedBoolean: BooleanAccess = ({ req: { user } }) => Boolean(user)

export const isManager: BooleanAccess = ({ req: { user } }) => hasRole(user, 'MANAGER')

export const isAdminOrOwner: Access = ({ req: { user } }) => hasAnyRole(user, 'ADMIN', 'OWNER')

export const isAdminOrOwnerOrManager: Access = ({ req: { user } }) =>
  hasAnyRole(user, 'ADMIN', 'OWNER', 'MANAGER')

export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

// No self branch: over REST it would change email/password without the current one.
export const canUpdateUser: Access = ({ req: { user } }) => {
  if (hasAnyRole(user, 'ADMIN', 'OWNER')) return true
  if (hasRole(user, 'MANAGER')) return { role: { equals: 'EMPLOYEE' } }
  return false
}

export const isAdminOrOwnerField: FieldAccess = ({ req: { user } }) =>
  hasAnyRole(user, 'ADMIN', 'OWNER')
