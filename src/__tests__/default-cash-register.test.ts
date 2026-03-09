import { describe, it, expect } from 'vitest'
import {
  getUserCashRegisterIds,
  getUserDefaultCashRegisterId,
  getDefaultCashRegister,
} from '@/lib/utils/default-cash-register'
import type { ReferenceDataT } from '@/types/reference-data'

// ── Helpers ──────────────────────────────────────────────────────────────

const baseRefData: ReferenceDataT = {
  currentUserId: 10,
  currentUserRole: 'EMPLOYEE',
  cashRegisters: [],
  investments: [],
  workers: [],
  otherCategories: [],
  expenseCategories: [],
}

const makeRefData = (overrides: Partial<ReferenceDataT>): ReferenceDataT => ({
  ...baseRefData,
  ...overrides,
})

// ── getUserCashRegisterIds ───────────────────────────────────────────────

describe('getUserCashRegisterIds', () => {
  it('returns undefined for ADMIN (unrestricted)', () => {
    const data = makeRefData({ currentUserRole: 'ADMIN' })
    expect(getUserCashRegisterIds(data)).toBeUndefined()
  })

  it('returns filtered IDs for non-admin user', () => {
    const data = makeRefData({
      currentUserId: 10,
      currentUserRole: 'MANAGER',
      cashRegisters: [
        { id: 1, name: 'A', ownerId: 10 },
        { id: 2, name: 'B', ownerId: 20 },
        { id: 3, name: 'C', ownerId: 10 },
      ],
    })
    expect(getUserCashRegisterIds(data)).toEqual([1, 3])
  })

  it('returns empty array when user owns no registers', () => {
    const data = makeRefData({
      currentUserId: 10,
      cashRegisters: [{ id: 1, name: 'A', ownerId: 99 }],
    })
    expect(getUserCashRegisterIds(data)).toEqual([])
  })
})

// ── getUserDefaultCashRegisterId ─────────────────────────────────────────

describe('getUserDefaultCashRegisterId', () => {
  it('returns defaultCashRegisterId when worker found', () => {
    const data = makeRefData({
      currentUserId: 10,
      workers: [{ id: 10, name: 'Jan', email: 'j@x.com', defaultCashRegisterId: 5 }],
    })
    expect(getUserDefaultCashRegisterId(data)).toBe(5)
  })

  it('returns undefined when worker not found', () => {
    const data = makeRefData({
      currentUserId: 10,
      workers: [{ id: 99, name: 'Other', email: 'o@x.com' }],
    })
    expect(getUserDefaultCashRegisterId(data)).toBeUndefined()
  })

  it('returns undefined when worker has no defaultCashRegisterId', () => {
    const data = makeRefData({
      currentUserId: 10,
      workers: [{ id: 10, name: 'Jan', email: 'j@x.com' }],
    })
    expect(getUserDefaultCashRegisterId(data)).toBeUndefined()
  })
})

// ── getDefaultCashRegister ───────────────────────────────────────────────

describe('getDefaultCashRegister', () => {
  it('priority 1: returns the single owned register', () => {
    const data = makeRefData({
      currentUserId: 10,
      currentUserRole: 'MANAGER',
      cashRegisters: [
        { id: 5, name: 'MyReg', ownerId: 10 },
        { id: 6, name: 'Other', ownerId: 20 },
      ],
      workers: [],
    })
    expect(getDefaultCashRegister(data)).toBe('5')
  })

  it('priority 2: admin with default register (unrestricted)', () => {
    const data = makeRefData({
      currentUserId: 10,
      currentUserRole: 'ADMIN',
      cashRegisters: [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ],
      workers: [{ id: 10, name: 'Admin', email: 'a@x.com', defaultCashRegisterId: 2 }],
    })
    expect(getDefaultCashRegister(data)).toBe('2')
  })

  it('priority 3: default register is in user allowed list', () => {
    const data = makeRefData({
      currentUserId: 10,
      currentUserRole: 'EMPLOYEE',
      cashRegisters: [
        { id: 1, name: 'A', ownerId: 10 },
        { id: 2, name: 'B', ownerId: 10 },
        { id: 3, name: 'C', ownerId: 20 },
      ],
      workers: [{ id: 10, name: 'Jan', email: 'j@x.com', defaultCashRegisterId: 2 }],
    })
    expect(getDefaultCashRegister(data)).toBe('2')
  })

  it('priority 4: default not in allowed list → empty string', () => {
    const data = makeRefData({
      currentUserId: 10,
      currentUserRole: 'EMPLOYEE',
      cashRegisters: [
        { id: 1, name: 'A', ownerId: 10 },
        { id: 2, name: 'B', ownerId: 10 },
        { id: 3, name: 'C', ownerId: 20 },
      ],
      workers: [{ id: 10, name: 'Jan', email: 'j@x.com', defaultCashRegisterId: 3 }],
    })
    expect(getDefaultCashRegister(data)).toBe('')
  })

  it('no default register and multiple owned → empty string', () => {
    const data = makeRefData({
      currentUserId: 10,
      currentUserRole: 'MANAGER',
      cashRegisters: [
        { id: 1, name: 'A', ownerId: 10 },
        { id: 2, name: 'B', ownerId: 10 },
      ],
      workers: [{ id: 10, name: 'Jan', email: 'j@x.com' }],
    })
    expect(getDefaultCashRegister(data)).toBe('')
  })

  it('no owned registers and no default → empty string', () => {
    const data = makeRefData({
      currentUserId: 10,
      currentUserRole: 'EMPLOYEE',
      cashRegisters: [{ id: 1, name: 'A', ownerId: 99 }],
      workers: [{ id: 10, name: 'Jan', email: 'j@x.com' }],
    })
    expect(getDefaultCashRegister(data)).toBe('')
  })
})
