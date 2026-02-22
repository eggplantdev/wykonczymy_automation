import { describe, it, expect } from 'vitest'
import {
  ROLES,
  MANAGEMENT_ROLES,
  ADMIN_OR_OWNER_ROLES,
  isManagementRole,
  isAdminOrOwnerRole,
} from '@/lib/auth/roles'
import type { RoleT } from '@/lib/auth/roles'

describe('isManagementRole', () => {
  it.each(['ADMIN', 'OWNER', 'MANAGER'] as RoleT[])('returns true for %s', (role) => {
    expect(isManagementRole(role)).toBe(true)
  })

  it('returns false for EMPLOYEE', () => {
    expect(isManagementRole('EMPLOYEE')).toBe(false)
  })

  it('matches MANAGEMENT_ROLES constant', () => {
    for (const role of ROLES) {
      expect(isManagementRole(role)).toBe(MANAGEMENT_ROLES.includes(role))
    }
  })
})

describe('isAdminOrOwnerRole', () => {
  it.each(['ADMIN', 'OWNER'] as RoleT[])('returns true for %s', (role) => {
    expect(isAdminOrOwnerRole(role)).toBe(true)
  })

  it.each(['MANAGER', 'EMPLOYEE'] as RoleT[])('returns false for %s', (role) => {
    expect(isAdminOrOwnerRole(role)).toBe(false)
  })

  it('matches ADMIN_OR_OWNER_ROLES constant', () => {
    for (const role of ROLES) {
      expect(isAdminOrOwnerRole(role)).toBe(ADMIN_OR_OWNER_ROLES.includes(role))
    }
  })
})
