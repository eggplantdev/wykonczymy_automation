import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import type { Payload } from 'payload'
import type { SessionUserT } from '@/types/auth'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

const mockDbExecute = vi.fn()

vi.mock('@/lib/db/sum-transfers', () => ({
  getDb: vi.fn().mockResolvedValue({ execute: (...args: unknown[]) => mockDbExecute(...args) }),
}))

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
    const result = await validateSourceRegister(999, adminUser, fakePayload)
    expect(result).toEqual({ success: false, error: 'Kasa nie istnieje' })
  })

  it('returns error for undefined cashRegisterId', async () => {
    const result = await validateSourceRegister(undefined, adminUser, fakePayload)
    expect(result).toEqual({ success: false, error: 'Kasa nie istnieje' })
  })

  it('ADMIN can access any register', async () => {
    mockRegisterLookup(1)
    const result = await validateSourceRegister(1, adminUser, fakePayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.register.id).toBe(1)
    }
  })

  it('MANAGER can access any register', async () => {
    // Register 3 has ownerId: 3, managerUser.id is 2
    mockRegisterLookup(3)
    const result = await validateSourceRegister(3, managerUser, fakePayload)
    expect(result.success).toBe(true)
  })
})
