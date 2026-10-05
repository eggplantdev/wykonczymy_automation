import { describe, it, expect } from 'vitest'
import {
  ROLES,
  MANAGEMENT_ROLES,
  ADMIN_OR_OWNER_ROLES,
  isManagementRole,
  isAdminOrOwnerRole,
  canTrashAccount,
  canViewWorkerPage,
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

describe('canTrashAccount', () => {
  it('never offers your own account', () => {
    expect(canTrashAccount({ id: 1, role: 'OWNER' }, { id: 1, role: 'OWNER' })).toBe(false)
  })

  it('lets a MANAGER trash only an EMPLOYEE', () => {
    const manager = { id: 1, role: 'MANAGER' as const }
    expect(canTrashAccount(manager, { id: 2, role: 'EMPLOYEE' })).toBe(true)
    expect(canTrashAccount(manager, { id: 3, role: 'OWNER' })).toBe(false)
    expect(canTrashAccount(manager, { id: 4, role: 'MANAGER' })).toBe(false)
  })

  it('lets an OWNER trash any other account', () => {
    expect(canTrashAccount({ id: 1, role: 'OWNER' }, { id: 2, role: 'OWNER' })).toBe(true)
  })
})

describe('canViewWorkerPage', () => {
  it.each(['ADMIN', 'OWNER', 'MANAGER'] as RoleT[])('lets %s open any worker page', (role) => {
    expect(canViewWorkerPage({ id: 1, role }, 25)).toBe(true)
  })

  it('lets an EMPLOYEE open only his own page', () => {
    expect(canViewWorkerPage({ id: 25, role: 'EMPLOYEE' }, 25)).toBe(true)
    expect(canViewWorkerPage({ id: 25, role: 'EMPLOYEE' }, 26)).toBe(false)
  })
})
