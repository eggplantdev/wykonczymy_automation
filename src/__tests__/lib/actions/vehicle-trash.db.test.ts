import { describe, vi } from 'vitest'
import { describeTrashContract } from '@/__tests__/helpers/trash-contract'

// The session is mocked rather than `requireAuth`, so the role gate under test is the real one.

vi.mock('server-only', () => ({}))

const { session } = vi.hoisted(() => ({ session: { role: 'OWNER' } }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: vi.fn(async () => ({ id: 1, role: session.role, name: 'T', email: 't@t.pl' })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('vehicle trash actions (DB)', () => {
  describeTrashContract({
    table: 'vehicles',
    nameColumn: 'registration',
    prefix: 'EX915 A',
    create: (payload, registration) =>
      payload.create({
        collection: 'vehicles',
        data: { registration, make: 'Ford', model: 'Transit', status: 'ACTIVE' },
        overrideAccess: true,
        context: { skipRevalidation: true },
      }),
    addChild: (payload, vehicleId) =>
      payload.create({
        collection: 'vehicle-inspections',
        data: { vehicle: vehicleId, type: 'TECHNICAL', performedAt: '2026-08-01T00:00:00.000Z' },
        overrideAccess: true,
        context: { skipRevalidation: true },
      }),
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
