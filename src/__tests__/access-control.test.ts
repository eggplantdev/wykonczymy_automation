import { describe, it, expect } from 'vitest'
import {
  hasAnyRole,
  isAdminOrOwnerOrManagerBoolean,
  isManager,
  isAdminOrOwner,
  isAdminOrOwnerOrManager,
  isAuthenticated,
  canUpdateUser,
  isAdminOrOwnerField,
} from '@/access/index'
import type { RoleT } from '@/lib/auth/roles'

const makeReq = (role: RoleT, id = 1) => ({ req: { user: { id, role } } })
const noUser = { req: { user: undefined } } as unknown as ReturnType<typeof makeReq>

const ALL_ROLES: RoleT[] = ['ADMIN', 'OWNER', 'MANAGER', 'EMPLOYEE']

describe('hasAnyRole', () => {
  it.each(ALL_ROLES)('returns true when user role is %s and checked roles include it', (role) => {
    expect(hasAnyRole({ id: 1, role }, role)).toBe(true)
  })

  it('returns true when role matches any in the list', () => {
    expect(hasAnyRole({ id: 1, role: 'MANAGER' }, 'ADMIN', 'MANAGER')).toBe(true)
  })

  it('returns false when role is not in the list', () => {
    expect(hasAnyRole({ id: 1, role: 'EMPLOYEE' }, 'ADMIN', 'OWNER')).toBe(false)
  })

  it('returns false for null user', () => {
    expect(hasAnyRole(null, 'ADMIN')).toBe(false)
  })

  it('returns false for undefined user', () => {
    expect(hasAnyRole(undefined, 'ADMIN')).toBe(false)
  })

  it('returns false for user without role', () => {
    expect(hasAnyRole({ id: 1 }, 'ADMIN')).toBe(false)
  })
})

describe('isAdminOrOwnerOrManagerBoolean', () => {
  it.each(['ADMIN', 'OWNER', 'MANAGER'] as RoleT[])('returns true for %s', (role) => {
    expect(isAdminOrOwnerOrManagerBoolean(makeReq(role) as never)).toBe(true)
  })

  it('returns false for EMPLOYEE', () => {
    expect(isAdminOrOwnerOrManagerBoolean(makeReq('EMPLOYEE') as never)).toBe(false)
  })
})

describe('isManager', () => {
  it('returns true for MANAGER', () => {
    expect(isManager(makeReq('MANAGER') as never)).toBe(true)
  })

  it.each(['ADMIN', 'OWNER', 'EMPLOYEE'] as RoleT[])('returns false for %s', (role) => {
    expect(isManager(makeReq(role) as never)).toBe(false)
  })
})

describe('isAdminOrOwner', () => {
  it.each(['ADMIN', 'OWNER'] as RoleT[])('returns true for %s', (role) => {
    expect(isAdminOrOwner(makeReq(role) as never)).toBe(true)
  })

  it.each(['MANAGER', 'EMPLOYEE'] as RoleT[])('returns false for %s', (role) => {
    expect(isAdminOrOwner(makeReq(role) as never)).toBe(false)
  })
})

describe('isAdminOrOwnerOrManager', () => {
  it.each(['ADMIN', 'OWNER', 'MANAGER'] as RoleT[])('returns true for %s', (role) => {
    expect(isAdminOrOwnerOrManager(makeReq(role) as never)).toBe(true)
  })

  it('returns false for EMPLOYEE', () => {
    expect(isAdminOrOwnerOrManager(makeReq('EMPLOYEE') as never)).toBe(false)
  })
})

describe('isAuthenticated', () => {
  it('returns true when user exists', () => {
    expect(isAuthenticated(makeReq('EMPLOYEE') as never)).toBe(true)
  })

  it('returns false when user is undefined', () => {
    expect(isAuthenticated(noUser as never)).toBe(false)
  })
})

describe('canUpdateUser', () => {
  const onId = (req: { req: unknown }, id: number) => ({ ...req, id }) as never

  it.each(['ADMIN', 'OWNER'] as RoleT[])('returns true for %s', (role) => {
    expect(canUpdateUser(onId(makeReq(role), 2))).toBe(true)
  })

  it('limits MANAGER to EMPLOYEE rows', () => {
    expect(canUpdateUser(onId(makeReq('MANAGER'), 2))).toEqual({ role: { equals: 'EMPLOYEE' } })
  })

  it('refuses an EMPLOYEE on his own row', () => {
    expect(canUpdateUser(onId(makeReq('EMPLOYEE', 7), 7))).toBe(false)
  })

  it('refuses an EMPLOYEE on another row', () => {
    expect(canUpdateUser(onId(makeReq('EMPLOYEE', 7), 8))).toBe(false)
  })

  it('returns false when no user', () => {
    expect(canUpdateUser(onId(noUser, 7))).toBe(false)
  })
})

describe('isAdminOrOwnerField', () => {
  it.each(['ADMIN', 'OWNER'] as RoleT[])('returns true for %s', (role) => {
    expect(isAdminOrOwnerField(makeReq(role) as never)).toBe(true)
  })

  it.each(['MANAGER', 'EMPLOYEE'] as RoleT[])('returns false for %s', (role) => {
    expect(isAdminOrOwnerField(makeReq(role) as never)).toBe(false)
  })
})
