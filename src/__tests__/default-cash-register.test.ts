import { describe, it, expect } from 'vitest'
import {
  getUserDefaultCashRegisterId,
  getDefaultCashRegister,
} from '@/lib/utils/default-cash-register'
import type { ReferenceDataT } from '@/types/reference-data'

// ── Helpers ──────────────────────────────────────────────────────────────

const baseRefData: ReferenceDataT = {
  currentUserId: 10,
  currentUserRole: 'ADMIN',
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

// ── getUserDefaultCashRegisterId ─────────────────────────────────────────

describe('getUserDefaultCashRegisterId', () => {
  it('returns defaultCashRegisterId when worker found', () => {
    const data = makeRefData({
      currentUserId: 10,
      workers: [
        { id: 10, name: 'Jan', type: 'EMPLOYEE', email: 'j@x.com', defaultCashRegisterId: 5 },
      ],
    })
    expect(getUserDefaultCashRegisterId(data)).toBe(5)
  })

  it('returns undefined when worker not found', () => {
    const data = makeRefData({
      currentUserId: 10,
      workers: [{ id: 99, name: 'Other', type: 'EMPLOYEE', email: 'o@x.com' }],
    })
    expect(getUserDefaultCashRegisterId(data)).toBeUndefined()
  })

  it('returns undefined when worker has no defaultCashRegisterId', () => {
    const data = makeRefData({
      currentUserId: 10,
      workers: [{ id: 10, name: 'Jan', type: 'EMPLOYEE', email: 'j@x.com' }],
    })
    expect(getUserDefaultCashRegisterId(data)).toBeUndefined()
  })
})

// ── getDefaultCashRegister ───────────────────────────────────────────────

describe('getDefaultCashRegister', () => {
  it('returns default register ID as string when it exists', () => {
    const data = makeRefData({
      currentUserId: 10,
      workers: [
        { id: 10, name: 'Admin', type: 'ADMIN', email: 'a@x.com', defaultCashRegisterId: 2 },
      ],
    })
    expect(getDefaultCashRegister(data)).toBe('2')
  })

  it('returns empty string when no default register', () => {
    const data = makeRefData({
      currentUserId: 10,
      workers: [{ id: 10, name: 'Jan', type: 'EMPLOYEE', email: 'j@x.com' }],
    })
    expect(getDefaultCashRegister(data)).toBe('')
  })

  it('returns empty string when worker not found', () => {
    const data = makeRefData({
      currentUserId: 10,
      workers: [],
    })
    expect(getDefaultCashRegister(data)).toBe('')
  })
})
