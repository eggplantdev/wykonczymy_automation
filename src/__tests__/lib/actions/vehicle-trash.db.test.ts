import { describe, vi } from 'vitest'
import { describeTrashContract } from '@/__tests__/helpers/trash-contract'
import { createTestInspection, createTestVehicle } from '@/__tests__/helpers/fleet-db'
import { ENV_READY } from '@/__tests__/helpers/payload'

// The session is mocked rather than `requireAuth`, so the role gate under test is the real one.

const { session } = vi.hoisted(() => ({ session: { role: 'OWNER' } }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: vi.fn(async () => ({ id: 1, role: session.role, name: 'T', email: 't@t.pl' })),
}))

describe.skipIf(!ENV_READY)('vehicle trash actions (DB)', () => {
  describeTrashContract({
    table: 'vehicles',
    nameColumn: 'registration',
    prefix: 'EX915 A',
    create: async (payload, registration) => ({
      id: await createTestVehicle(payload, registration),
    }),
    addChild: (payload, vehicleId) =>
      createTestInspection(payload, vehicleId, '2026-08-01T00:00:00.000Z'),
    childTable: 'vehicle_inspections',
    childForeignKey: 'vehicle_id',
    loadActions: async () => {
      const actions = await import('@/lib/actions/vehicle-trash')
      return {
        trash: actions.trashVehicleAction,
        restore: actions.restoreVehicleAction,
        deleteForever: actions.deleteVehicleForeverAction,
      }
    },
    setRole: (role) => {
      session.role = role
    },
    missingError: 'Pojazd nie istnieje.',
    notInTrashError: 'Najpierw przenieś pojazd do kosza.',
    revalidated: { trash: ['vehicles'], deleteForever: ['vehicles', 'vehicleInspections'] },
  })
})
