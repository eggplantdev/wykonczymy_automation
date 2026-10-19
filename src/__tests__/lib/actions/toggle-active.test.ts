import { describe, it, expect, vi, beforeEach } from 'vitest'
import { revalidateCollections } from '@/__tests__/stubs/cache-revalidate'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import type { Payload } from 'payload'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const mockUpdate = vi.fn()
const mockPayload = { update: mockUpdate } as unknown as Payload

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn().mockResolvedValue(mockPayload),
  }
})

vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn() }))
vi.mock('@/lib/db/user-sessions', () => ({ deleteUserSessions: vi.fn() }))
vi.mock('@/lib/db/push-subscriptions', () => ({ deletePushSubscriptions: vi.fn() }))
vi.mock('@/lib/db/account-removal', () => ({ fetchRemovalSubject: vi.fn() }))

const { toggleUserActive, toggleCashRegisterActive } = await import('@/lib/actions/toggle-active')

beforeEach(() => {
  authState.userId = 1
  authState.role = 'ADMIN'
  mockUpdate.mockReset().mockResolvedValue({ id: 1 })
  revalidateCollections.mockReset()
})

describe('toggleUserActive', () => {
  it.each([true, false])('active=%s → updates user with that flag', async (active) => {
    const result = await toggleUserActive(1, active)

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      collection: 'users',
      id: 1,
      data: { active },
      overrideAccess: true,
    })
  })

  it('revalidates "users" collection on success', async () => {
    await toggleUserActive(1, true)

    expect(revalidateCollections).toHaveBeenCalledOnce()
    expect(revalidateCollections).toHaveBeenCalledWith(['users'])
  })

  it('refuses an EMPLOYEE, writing nothing', async () => {
    authState.role = 'EMPLOYEE'

    const result = await toggleUserActive(2, true)

    expect(result).toEqual({ success: false, error: 'Brak uprawnień' })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(revalidateCollections).not.toHaveBeenCalled()
  })

  it('payload.update throws → returns { success: false, error: message }', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Connection refused'))

    const result = await toggleUserActive(1, true)

    expect(result).toEqual({ success: false, error: 'Connection refused' })
    expect(revalidateCollections).not.toHaveBeenCalled()
  })
})

describe('toggleCashRegisterActive', () => {
  it.each([true, false])('active=%s → updates cash register with that flag', async (active) => {
    const result = await toggleCashRegisterActive(5, active)

    expect(result).toEqual({ success: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      collection: 'cash-registers',
      id: 5,
      data: { active },
      overrideAccess: true,
    })
  })

  it('revalidates "cashRegisters" collection on success', async () => {
    await toggleCashRegisterActive(5, true)

    expect(revalidateCollections).toHaveBeenCalledOnce()
    expect(revalidateCollections).toHaveBeenCalledWith(['cashRegisters'])
  })
})
