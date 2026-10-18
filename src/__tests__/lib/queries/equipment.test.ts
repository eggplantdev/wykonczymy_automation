import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

vi.mock('payload', () => ({ getPayload: async () => ({}) }))
vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

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
    authState.userId = 25
    authState.role = 'EMPLOYEE'
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
    authState.userId = 1
    authState.role = 'MANAGER'

    await fetchEquipmentAtLocation({ kind: 'holder', id: 7 })
    await fetchEquipmentAtLocation({ kind: 'warehouse', id: 3 })

    expect(loadEquipmentAtLocation).toHaveBeenCalledTimes(2)
  })
})
