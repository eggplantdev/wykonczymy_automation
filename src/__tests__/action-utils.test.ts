import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import type { Payload } from 'payload'
import type { SessionUserT } from '@/types/auth'
import type { ReferenceItemT, ReferenceDataBaseT } from '@/types/reference-data'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

const mockSumRegisterBalance = vi.fn()
vi.mock('@/lib/db/sum-transfers', () => ({
  sumRegisterBalance: (...args: unknown[]) => mockSumRegisterBalance(...args),
}))

const mockFetchReferenceData = vi.fn()
vi.mock('@/lib/queries/reference-data', () => ({
  fetchReferenceData: (...args: unknown[]) => mockFetchReferenceData(...args),
}))

const { getErrorMessage, validateAction, validateSourceRegister, checkIfSufficientBalance } =
  await import('@/lib/actions/utils')

const fakePayload = {} as Payload

const adminUser: SessionUserT = { id: 1, email: 'a@t.com', name: 'Admin', role: 'ADMIN' }
const managerUser: SessionUserT = { id: 2, email: 'm@t.com', name: 'Manager', role: 'MANAGER' }
const employeeUser: SessionUserT = { id: 3, email: 'e@t.com', name: 'Emp', role: 'EMPLOYEE' }

const refData: ReferenceDataBaseT = {
  cashRegisters: [
    { id: 1, name: 'Main', type: 'MAIN', active: true, ownerId: 2 },
    { id: 2, name: 'Virtual', type: 'VIRTUAL', active: true, ownerId: 1 },
    { id: 3, name: 'Aux', type: 'AUXILIARY', active: true, ownerId: 3 },
  ],
  investments: [],
  workers: [],
  otherCategories: [],
}

beforeEach(() => {
  mockSumRegisterBalance.mockReset()
  mockFetchReferenceData.mockReset()
  mockFetchReferenceData.mockResolvedValue(refData)
})

// ── getErrorMessage ──────────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns default for non-Error', () => {
    expect(getErrorMessage('string error')).toBe('Wystąpił błąd')
  })

  it('returns default for null', () => {
    expect(getErrorMessage(null)).toBe('Wystąpił błąd')
  })

  it('returns default for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('Wystąpił błąd')
  })
})

// ── validateAction ───────────────────────────────────────────────────────

describe('validateAction', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().positive('Age must be positive'),
  })

  it('returns parsed data on valid input', () => {
    const result = validateAction(schema, { name: 'Jan', age: 25 })
    expect(result).toEqual({ success: true, data: { name: 'Jan', age: 25 } })
  })

  it('returns first error message on invalid input', () => {
    const result = validateAction(schema, { name: '', age: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(typeof result.error).toBe('string')
      expect(result.error.length).toBeGreaterThan(0)
    }
  })

  it('returns error for completely wrong data', () => {
    const result = validateAction(schema, null)
    expect(result.success).toBe(false)
  })
})

// ── validateSourceRegister ───────────────────────────────────────────────

describe('validateSourceRegister', () => {
  it('returns error when register not found', async () => {
    const result = await validateSourceRegister(999, adminUser)
    expect(result).toEqual({ success: false, error: 'Kasa nie istnieje' })
  })

  it('returns error for undefined cashRegisterId', async () => {
    const result = await validateSourceRegister(undefined, adminUser)
    expect(result).toEqual({ success: false, error: 'Kasa nie istnieje' })
  })

  it('ADMIN can access any register', async () => {
    const result = await validateSourceRegister(1, adminUser)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.register.id).toBe(1)
    }
  })

  it('MANAGER can access own register', async () => {
    // Register 1 has ownerId: 2, managerUser.id is 2
    const result = await validateSourceRegister(1, managerUser)
    expect(result.success).toBe(true)
  })

  it('MANAGER cannot access another user register', async () => {
    // Register 3 has ownerId: 3, managerUser.id is 2
    const result = await validateSourceRegister(3, managerUser)
    expect(result).toEqual({ success: false, error: 'Nie masz uprawnień do tej kasy' })
  })

  it('EMPLOYEE cannot access register they do not own', async () => {
    // Register 1 has ownerId: 2, employeeUser.id is 3
    const result = await validateSourceRegister(1, employeeUser)
    expect(result).toEqual({ success: false, error: 'Nie masz uprawnień do tej kasy' })
  })

  it('EMPLOYEE can access own register', async () => {
    // Register 3 has ownerId: 3, employeeUser.id is 3
    const result = await validateSourceRegister(3, employeeUser)
    expect(result.success).toBe(true)
  })
})

// ── checkIfSufficientBalance ─────────────────────────────────────────────

describe('checkIfSufficientBalance', () => {
  const normalRegister: ReferenceItemT = { id: 1, name: 'Main', type: 'MAIN', active: true }
  const virtualRegister: ReferenceItemT = { id: 2, name: 'Virtual', type: 'VIRTUAL', active: true }

  it('skips balance check for VIRTUAL register', async () => {
    const result = await checkIfSufficientBalance(virtualRegister, 999999, fakePayload)
    expect(result).toEqual({ success: true })
    expect(mockSumRegisterBalance).not.toHaveBeenCalled()
  })

  it('succeeds when balance > amount', async () => {
    mockSumRegisterBalance.mockResolvedValue(1000)
    const result = await checkIfSufficientBalance(normalRegister, 500, fakePayload)
    expect(result).toEqual({ success: true })
  })

  it('fails when balance === amount (not strictly greater)', async () => {
    mockSumRegisterBalance.mockResolvedValue(500)
    const result = await checkIfSufficientBalance(normalRegister, 500, fakePayload)
    expect(result.success).toBe(false)
  })

  it('fails when balance < amount', async () => {
    mockSumRegisterBalance.mockResolvedValue(100)
    const result = await checkIfSufficientBalance(normalRegister, 500, fakePayload)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('100.00')
    }
  })

  it('fails when balance is 0', async () => {
    mockSumRegisterBalance.mockResolvedValue(0)
    const result = await checkIfSufficientBalance(normalRegister, 1, fakePayload)
    expect(result.success).toBe(false)
  })
})
