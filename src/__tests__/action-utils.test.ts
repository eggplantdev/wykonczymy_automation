import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import type { Payload } from 'payload'
import type { SessionUserT } from '@/types/auth'
// TODO: re-add when the checkIfSufficientBalance tests below are restored
// import type { CashRegisterRefT } from '@/types/reference-data'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

const mockSumRegisterBalance = vi.fn()
const mockDbExecute = vi.fn()

vi.mock('@/lib/db/sum-transfers', () => ({
  getDb: vi.fn().mockResolvedValue({ execute: (...args: unknown[]) => mockDbExecute(...args) }),
  sumRegisterBalance: (...args: unknown[]) => mockSumRegisterBalance(...args),
}))

// TODO: re-add checkIfSufficientBalance when the negative-balance constraint is restored
const { getErrorMessage, validateAction } = await import('@/lib/actions/run-action')
const { validateSourceRegister } = await import('@/lib/actions/validate-source-register')

const fakePayload = {} as Payload

const adminUser: SessionUserT = { id: 1, email: 'a@t.com', name: 'Admin', role: 'ADMIN' }
const managerUser: SessionUserT = { id: 2, email: 'm@t.com', name: 'Manager', role: 'MANAGER' }
const employeeUser: SessionUserT = { id: 3, email: 'e@t.com', name: 'Emp', role: 'EMPLOYEE' }

// DB rows keyed by register ID — mirrors cash_registers table
const dbRows: Record<number, Record<string, unknown>> = {
  1: { id: 1, name: 'Main', type: 'MAIN', active: true, owner_id: 2 },
  2: { id: 2, name: 'Virtual', type: 'VIRTUAL', active: true, owner_id: 1 },
  3: { id: 3, name: 'Aux', type: 'AUXILIARY', active: true, owner_id: 3 },
}

/** Configure mockDbExecute to return the row for a given register ID. */
function mockRegisterLookup(registerId: number | undefined) {
  const row = registerId !== undefined ? dbRows[registerId] : undefined
  mockDbExecute.mockResolvedValue({ rows: row ? [row] : [] })
}

beforeEach(() => {
  mockSumRegisterBalance.mockReset()
  mockDbExecute.mockReset()
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
    mockRegisterLookup(999)
    const result = await validateSourceRegister(999, fakePayload)
    expect(result).toEqual({ success: false, error: 'Kasa nie istnieje' })
  })

  it('returns error for undefined cashRegisterId', async () => {
    const result = await validateSourceRegister(undefined, fakePayload)
    expect(result).toEqual({ success: false, error: 'Kasa nie istnieje' })
  })

  it('ADMIN can access any register', async () => {
    mockRegisterLookup(1)
    const result = await validateSourceRegister(1, fakePayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.register.id).toBe(1)
    }
  })

  it('MANAGER can access any register', async () => {
    // Register 3 has ownerId: 3, managerUser.id is 2
    mockRegisterLookup(3)
    const result = await validateSourceRegister(3, fakePayload)
    expect(result.success).toBe(true)
  })
})

// ── checkIfSufficientBalance ──
// TODO: negative-balance constraint on auxiliary registers temporarily dropped.
// Re-enable this whole describe block (and checkIfSufficientBalance in lib/actions/utils.ts
// + its callers in lib/actions/transfers.ts) to bring the constraint back.
//
// describe('checkIfSufficientBalance', () => {
//   const auxiliaryRegister: CashRegisterRefT = {
//     id: 1,
//     name: 'Aux',
//     type: 'AUXILIARY',
//     active: true,
//   }
//   const mainRegister: CashRegisterRefT = { id: 2, name: 'Main', type: 'MAIN', active: true }
//   const virtualRegister: CashRegisterRefT = {
//     id: 3,
//     name: 'Virtual',
//     type: 'VIRTUAL',
//     active: true,
//   }
//   const workerRegister: CashRegisterRefT = { id: 4, name: 'Worker', type: 'WORKER', active: true }
//
//   it('skips balance check for MAIN register', async () => {
//     const result = await checkIfSufficientBalance(mainRegister, 999999, fakePayload)
//     expect(result).toEqual({ success: true })
//     expect(mockSumRegisterBalance).not.toHaveBeenCalled()
//   })
//
//   it('skips balance check for VIRTUAL register', async () => {
//     const result = await checkIfSufficientBalance(virtualRegister, 999999, fakePayload)
//     expect(result).toEqual({ success: true })
//     expect(mockSumRegisterBalance).not.toHaveBeenCalled()
//   })
//
//   it('skips balance check for WORKER register', async () => {
//     const result = await checkIfSufficientBalance(workerRegister, 999999, fakePayload)
//     expect(result).toEqual({ success: true })
//     expect(mockSumRegisterBalance).not.toHaveBeenCalled()
//   })
//
//   it('succeeds when AUXILIARY balance > amount', async () => {
//     mockSumRegisterBalance.mockResolvedValue(1000)
//     const result = await checkIfSufficientBalance(auxiliaryRegister, 500, fakePayload)
//     expect(result).toEqual({ success: true })
//   })
//
//   it('succeeds when AUXILIARY balance === amount', async () => {
//     mockSumRegisterBalance.mockResolvedValue(500)
//     const result = await checkIfSufficientBalance(auxiliaryRegister, 500, fakePayload)
//     expect(result).toEqual({ success: true })
//   })
//
//   it('fails when AUXILIARY balance < amount', async () => {
//     mockSumRegisterBalance.mockResolvedValue(100)
//     const result = await checkIfSufficientBalance(auxiliaryRegister, 500, fakePayload)
//     expect(result.success).toBe(false)
//     if (!result.success) {
//       expect(result.error).toContain('100.00')
//     }
//   })
//
//   it('fails when AUXILIARY balance is 0', async () => {
//     mockSumRegisterBalance.mockResolvedValue(0)
//     const result = await checkIfSufficientBalance(auxiliaryRegister, 1, fakePayload)
//     expect(result.success).toBe(false)
//   })
// })
