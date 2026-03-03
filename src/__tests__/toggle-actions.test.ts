import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

// Mock requireAuth — default to success, overridden per-test for failures
const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

// Mock payload
const mockUpdate = vi.fn()
const mockPayload = { update: mockUpdate } as unknown as Payload

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn().mockResolvedValue(mockPayload),
  }
})

// Mock cache revalidation — toggle-active.ts uses revalidateCollection (singular)
const mockRevalidateCollection = vi.fn()
vi.mock('@/lib/cache/revalidate', () => ({
  revalidateCollection: (...args: unknown[]) => mockRevalidateCollection(...args),
  revalidateCollections: vi.fn(),
}))

// ── Import actions under test ────────────────────────────────────────────

const { toggleUserActive, toggleCashRegisterActive, toggleInvestmentStatus } =
  await import('@/lib/actions/toggle-active')

// ── Helpers ──────────────────────────────────────────────────────────────

const mockUser = { id: 1, email: 'a@t.com', name: 'Admin', role: 'ADMIN' as const }

beforeEach(() => {
  mockRequireAuth.mockReset().mockResolvedValue({ success: true, user: mockUser })
  mockUpdate.mockReset().mockResolvedValue({ id: 1 })
  mockRevalidateCollection.mockReset()
})

// ═════════════════════════════════════════════════════════════════════════
// toggleUserActive
// ═════════════════════════════════════════════════════════════════════════

describe('toggleUserActive', () => {
  it('active=true → updates user with active: true', async () => {
    const result = await toggleUserActive(1, true)

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      collection: 'users',
      id: 1,
      data: { active: true },
      overrideAccess: true,
    })
  })

  it('active=false → updates user with active: false', async () => {
    const result = await toggleUserActive(1, false)

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      collection: 'users',
      id: 1,
      data: { active: false },
      overrideAccess: true,
    })
  })

  it('calls payload.update with collection="users" and overrideAccess=true', async () => {
    await toggleUserActive(42, true)

    expect(mockUpdate).toHaveBeenCalledOnce()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        overrideAccess: true,
      }),
    )
  })

  it('revalidates "users" collection on success', async () => {
    await toggleUserActive(1, true)

    expect(mockRevalidateCollection).toHaveBeenCalledOnce()
    expect(mockRevalidateCollection).toHaveBeenCalledWith('users')
  })

  it('auth failure → returns { success: false } without update', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: false, error: 'Unauthorized' })

    const result = await toggleUserActive(1, true)

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockRevalidateCollection).not.toHaveBeenCalled()
  })

  it('payload.update throws → returns { success: false, error: message }', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Connection refused'))

    const result = await toggleUserActive(1, true)

    expect(result).toEqual({ success: false, error: 'Connection refused' })
    expect(mockRevalidateCollection).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════
// toggleCashRegisterActive
// ═════════════════════════════════════════════════════════════════════════

describe('toggleCashRegisterActive', () => {
  it('active=true → updates cash register with active: true', async () => {
    const result = await toggleCashRegisterActive(5, true)

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      collection: 'cash-registers',
      id: 5,
      data: { active: true },
      overrideAccess: true,
    })
  })

  it('active=false → updates cash register with active: false', async () => {
    const result = await toggleCashRegisterActive(5, false)

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      collection: 'cash-registers',
      id: 5,
      data: { active: false },
      overrideAccess: true,
    })
  })

  it('calls payload.update with collection="cash-registers" and overrideAccess=true', async () => {
    await toggleCashRegisterActive(10, false)

    expect(mockUpdate).toHaveBeenCalledOnce()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'cash-registers',
        overrideAccess: true,
      }),
    )
  })

  it('revalidates "cashRegisters" collection on success', async () => {
    await toggleCashRegisterActive(5, true)

    expect(mockRevalidateCollection).toHaveBeenCalledOnce()
    expect(mockRevalidateCollection).toHaveBeenCalledWith('cashRegisters')
  })

  it('auth failure → returns error without update', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: false, error: 'Unauthorized' })

    const result = await toggleCashRegisterActive(5, true)

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockRevalidateCollection).not.toHaveBeenCalled()
  })

  it('payload.update throws → returns error', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Unique constraint violated'))

    const result = await toggleCashRegisterActive(5, false)

    expect(result).toEqual({ success: false, error: 'Unique constraint violated' })
    expect(mockRevalidateCollection).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════
// toggleInvestmentStatus
// ═════════════════════════════════════════════════════════════════════════

describe('toggleInvestmentStatus', () => {
  it('active=true → updates with status="active"', async () => {
    const result = await toggleInvestmentStatus(3, true)

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      collection: 'investments',
      id: 3,
      data: { status: 'active' },
    })
  })

  it('active=false → updates with status="completed"', async () => {
    const result = await toggleInvestmentStatus(3, false)

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      collection: 'investments',
      id: 3,
      data: { status: 'completed' },
    })
  })

  it('calls payload.update with collection="investments" without overrideAccess', async () => {
    await toggleInvestmentStatus(7, true)

    expect(mockUpdate).toHaveBeenCalledOnce()

    const callArgs = mockUpdate.mock.calls[0][0]
    expect(callArgs.collection).toBe('investments')
    expect(callArgs).not.toHaveProperty('overrideAccess')
  })

  it('revalidates "investments" collection on success', async () => {
    await toggleInvestmentStatus(3, true)

    expect(mockRevalidateCollection).toHaveBeenCalledOnce()
    expect(mockRevalidateCollection).toHaveBeenCalledWith('investments')
  })

  it('auth failure → returns error without update', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: false, error: 'Unauthorized' })

    const result = await toggleInvestmentStatus(3, true)

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockRevalidateCollection).not.toHaveBeenCalled()
  })

  it('payload.update throws → returns error', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Timeout exceeded'))

    const result = await toggleInvestmentStatus(3, false)

    expect(result).toEqual({ success: false, error: 'Timeout exceeded' })
    expect(mockRevalidateCollection).not.toHaveBeenCalled()
  })
})
