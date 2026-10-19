import { describe } from 'vitest'
import type { Payload } from 'payload'
import { describeTrashContract } from '@/__tests__/helpers/trash-contract'
import { createTestEquipment } from '@/__tests__/helpers/fleet-db'
import { ENV_READY } from '@/__tests__/helpers/payload'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

describe.skipIf(!ENV_READY)('equipment trash actions (DB)', () => {
  describeTrashContract({
    table: 'equipment',
    nameColumn: 'name',
    prefix: 'EX-916 akcje',
    create: async (payload, name) => ({ id: await createTestEquipment(payload, name) }),
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
      authState.role = role
    },
    missingError: 'Sprzęt nie istnieje.',
    notInTrashError: 'Najpierw przenieś sprzęt do kosza.',
    revalidated: { trash: ['equipment'], deleteForever: ['equipment', 'equipmentEvents'] },
  })
})
