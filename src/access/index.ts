/**
 * Payload CMS access control functions.
 * Used in collection/global configs to restrict CRUD operations and field visibility.
 * For app-level role checks (server actions, components), see `@/lib/auth/roles.ts`.
 */
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

const hasAnyRole = (user: UserWithRole, ...roles: RoleT[]): boolean =>
  roles.some((role) => hasRole(user, role))

// --- Boolean-only access (for `admin`, `unlock`, field-level) ---

type BooleanAccess = ({ req }: { req: PayloadRequest }) => boolean

export const isAdminBoolean: BooleanAccess = ({ req: { user } }) => hasRole(user, 'ADMIN')

export const isAdminOrOwnerOrManagerBoolean: BooleanAccess = ({ req: { user } }) =>
  hasAnyRole(user, 'ADMIN', 'OWNER', 'MANAGER')

// --- Collection-level access (can return boolean | Where) ---

export const isAdmin: Access = ({ req: { user } }) => hasRole(user, 'ADMIN')

export const isAdminOrOwner: Access = ({ req: { user } }) => hasAnyRole(user, 'ADMIN', 'OWNER')

export const isAdminOrOwnerOrManager: Access = ({ req: { user } }) =>
  hasAnyRole(user, 'ADMIN', 'OWNER', 'MANAGER')

export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

export const isAdminOrSelf: Access = ({ req: { user }, id }) => {
  if (hasAnyRole(user, 'ADMIN', 'OWNER')) return true
  return user?.id === id
}

/**
 * Higher-order access: privileged roles get full access,
 * others get a Where clause filtering by `field = user.id`.
 */
export const rolesOrSelfField =
  (field: string, ...roles: RoleT[]): Access =>
  ({ req: { user } }) => {
    if (!user) return false
    if (hasAnyRole(user, ...roles)) return true
    return { [field]: { equals: user.id } }
  }

// --- Field-level access ---

export const isAdminField: FieldAccess = ({ req: { user } }) => hasRole(user, 'ADMIN')

export const isAdminOrOwnerField: FieldAccess = ({ req: { user } }) =>
  hasAnyRole(user, 'ADMIN', 'OWNER')
