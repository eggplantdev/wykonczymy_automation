import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RoleT } from '@/lib/auth/roles'

// The held-equipment list on the worker page is a client-callable read open to an EMPLOYEE — the
// gate must hand him his own holder list and nothing else.
vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({}) }))

const session = vi.hoisted(() => ({ user: { id: 25, role: 'EMPLOYEE' as RoleT } }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { ...session.user, email: 'w@example.test', name: 'Pracownik' },
  })),
}))

const loadEquipmentAtLocation = vi.fn(async () => [])
vi.mock('@/lib/db/equipment', () => ({
  loadEquipmentAtLocation: () => loadEquipmentAtLocation(),
  loadEquipmentById: vi.fn(),
  loadEquipmentHistory: vi.fn(),
  loadEquipmentOverview: vi.fn(),
}))

const { fetchEquipmentAtLocation } = await import('@/lib/queries/equipment')

describe('fetchEquipmentAtLocation', () => {
  beforeEach(() => {
    loadEquipmentAtLocation.mockClear()
    session.user = { id: 25, role: 'EMPLOYEE' }
  })

  it('lets an EMPLOYEE read the equipment he holds', async () => {
    await expect(fetchEquipmentAtLocation({ kind: 'holder', id: 25 })).resolves.toEqual([])
    expect(loadEquipmentAtLocation).toHaveBeenCalledOnce()
  })

  it("refuses an EMPLOYEE another worker's equipment", async () => {
    await expect(fetchEquipmentAtLocation({ kind: 'holder', id: 7 })).rejects.toThrow()
    expect(loadEquipmentAtLocation).not.toHaveBeenCalled()
  })

  it('refuses an EMPLOYEE a warehouse', async () => {
    await expect(fetchEquipmentAtLocation({ kind: 'warehouse', id: 3 })).rejects.toThrow()
    expect(loadEquipmentAtLocation).not.toHaveBeenCalled()
  })

  it('lets management read any holder and any warehouse', async () => {
    session.user = { id: 1, role: 'MANAGER' }

    await fetchEquipmentAtLocation({ kind: 'holder', id: 7 })
    await fetchEquipmentAtLocation({ kind: 'warehouse', id: 3 })

    expect(loadEquipmentAtLocation).toHaveBeenCalledTimes(2)
  })
})
