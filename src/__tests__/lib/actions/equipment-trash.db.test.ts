import { describe, vi } from 'vitest'
import type { Payload } from 'payload'
import { describeTrashContract } from '@/__tests__/helpers/trash-contract'

// The session is mocked rather than `requireAuth`, so the role gate under test is the real one.

vi.mock('server-only', () => ({}))

const { session } = vi.hoisted(() => ({ session: { role: 'OWNER' } }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: vi.fn(async () => ({ id: 1, role: session.role, name: 'T', email: 't@t.pl' })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('equipment trash actions (DB)', () => {
  describeTrashContract({
    table: 'equipment',
    nameColumn: 'name',
    prefix: 'EX-916 akcje',
    create: (payload, name) =>
      payload.create({
        collection: 'equipment',
        data: { name, status: 'IN_USE' },
        overrideAccess: true,
        context: { skipRevalidation: true },
      }),
    addChild: (payload, equipmentId) =>
      payload.create({
        collection: 'equipment-events',
        data: {
          equipment: equipmentId,
          occurredAt: '2026-08-01T00:00:00.000Z',
          serviceProvider: 'Serwis',
        },
        overrideAccess: true,
        context: { skipRevalidation: true },
      } as Parameters<Payload['create']>[0]),
    childTable: 'equipment_events',
    childForeignKey: 'equipment_id',
    loadActions: async () => {
      const actions = await import('@/lib/actions/equipment-trash')
      return {
        trash: actions.trashEquipmentAction,
        restore: actions.restoreEquipmentAction,
        deleteForever: actions.deleteEquipmentForeverAction,
      }
    },
    setRole: (role) => {
      session.role = role
    },
    missingError: 'Sprzęt nie istnieje.',
    notInTrashError: 'Najpierw przenieś sprzęt do kosza.',
    revalidated: { trash: ['equipment'], deleteForever: ['equipment', 'equipmentEvents'] },
  })
})
