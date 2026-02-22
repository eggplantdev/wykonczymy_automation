import { describe, it, expect } from 'vitest'
import {
  hasAnyRole,
  isAdminBoolean,
  isAdminOrOwnerOrManagerBoolean,
  isManager,
  isAdmin,
  isAdminOrOwner,
  isAdminOrOwnerOrManager,
  isAuthenticated,
  isAdminOrOwnerOrSelf,
  rolesOrSelfField,
  isAdminField,
  isAdminOrOwnerField,
} from '@/access/index'
import type { RoleT } from '@/lib/auth/roles'

// ── Helpers ──────────────────────────────────────────────────────────────

const makeReq = (role: RoleT, id = 1) => ({ req: { user: { id, role } } })
const noUser = { req: { user: undefined } } as unknown as ReturnType<typeof makeReq>

const ALL_ROLES: RoleT[] = ['ADMIN', 'OWNER', 'MANAGER', 'EMPLOYEE']

// ── hasAnyRole ───────────────────────────────────────────────────────────

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

// ── Boolean-only access ──────────────────────────────────────────────────

describe('isAdminBoolean', () => {
  it('returns true for ADMIN', () => {
    expect(isAdminBoolean(makeReq('ADMIN') as never)).toBe(true)
  })

  it.each(['OWNER', 'MANAGER', 'EMPLOYEE'] as RoleT[])('returns false for %s', (role) => {
    expect(isAdminBoolean(makeReq(role) as never)).toBe(false)
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

// ── Collection-level access ──────────────────────────────────────────────

describe('isAdmin', () => {
  it('returns true for ADMIN', () => {
    expect(isAdmin(makeReq('ADMIN') as never)).toBe(true)
  })

  it('returns false for non-ADMIN', () => {
    expect(isAdmin(makeReq('EMPLOYEE') as never)).toBe(false)
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

// ── isAdminOrOwnerOrSelf ─────────────────────────────────────────────────

describe('isAdminOrOwnerOrSelf', () => {
  it('returns true for ADMIN regardless of id', () => {
    expect(isAdminOrOwnerOrSelf({ ...makeReq('ADMIN', 1), id: 99 } as never)).toBe(true)
  })

  it('returns true for OWNER regardless of id', () => {
    expect(isAdminOrOwnerOrSelf({ ...makeReq('OWNER', 1), id: 99 } as never)).toBe(true)
  })

  it('returns true when user id matches resource id (self)', () => {
    expect(isAdminOrOwnerOrSelf({ ...makeReq('EMPLOYEE', 42), id: 42 } as never)).toBe(true)
  })

  it('returns false when EMPLOYEE id does not match', () => {
    expect(isAdminOrOwnerOrSelf({ ...makeReq('EMPLOYEE', 1), id: 99 } as never)).toBe(false)
  })

  it('returns false when MANAGER id does not match', () => {
    expect(isAdminOrOwnerOrSelf({ ...makeReq('MANAGER', 1), id: 99 } as never)).toBe(false)
  })
})

// ── rolesOrSelfField ─────────────────────────────────────────────────────

describe('rolesOrSelfField', () => {
  const accessFn = rolesOrSelfField('worker_id', 'ADMIN', 'OWNER')

  it('returns true for ADMIN', () => {
    expect(accessFn(makeReq('ADMIN') as never)).toBe(true)
  })

  it('returns true for OWNER', () => {
    expect(accessFn(makeReq('OWNER') as never)).toBe(true)
  })

  it('returns Where clause for MANAGER', () => {
    expect(accessFn(makeReq('MANAGER', 42) as never)).toEqual({
      worker_id: { equals: 42 },
    })
  })

  it('returns Where clause for EMPLOYEE', () => {
    expect(accessFn(makeReq('EMPLOYEE', 7) as never)).toEqual({
      worker_id: { equals: 7 },
    })
  })

  it('returns false when no user', () => {
    expect(accessFn(noUser as never)).toBe(false)
  })
})

// ── Field-level access ───────────────────────────────────────────────────

describe('isAdminField', () => {
  it('returns true for ADMIN', () => {
    expect(isAdminField(makeReq('ADMIN') as never)).toBe(true)
  })

  it.each(['OWNER', 'MANAGER', 'EMPLOYEE'] as RoleT[])('returns false for %s', (role) => {
    expect(isAdminField(makeReq(role) as never)).toBe(false)
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
