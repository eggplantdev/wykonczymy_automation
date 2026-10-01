'use server'

import type { Payload } from 'payload'
import {
  addEquipmentSchema,
  equipmentSchema,
  type AddEquipmentDataT,
  type EquipmentFormDataT,
} from '@/components/forms/equipment-form/equipment-schema'
import {
  equipmentTransferSchema,
  type EquipmentTransferDataT,
} from '@/components/forms/equipment-transfer-form/equipment-transfer-schema'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { protectedAction, validateAction } from './run-action'

// A trashed item still holds its serial, so the refusal has to say where to find it — otherwise the
// owner is told the serial is taken by an item no listing shows.
async function serialClash(payload: Payload, serialNumber: string | null, ownId?: number) {
  const serial = serialNumber?.trim()
  if (!serial) return undefined
  const { docs } = await payload.find({
    collection: 'equipment',
    where: {
      and: [
        { serialNumber: { equals: serial } },
        ...(ownId === undefined ? [] : [{ id: { not_equals: ownId } }]),
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const holder = docs[0]
  if (!holder) return undefined
  return holder.trashedAt
    ? `Sprzęt o numerze seryjnym ${serial} jest w Koszu — przywróć go stamtąd.`
    : `Sprzęt o numerze seryjnym ${serial} już istnieje.`
}

export async function createEquipmentAction(data: AddEquipmentDataT) {
  return protectedAction(
    'createEquipmentAction',
    async ({ payload, user }) => {
      const parsed = validateAction(addEquipmentSchema, data)
      if (!parsed.success) return parsed

      const { occurredAt, holder, warehouse, serviceProvider, investment, ...item } = parsed.data

      const clash = await serialClash(payload, item.serialNumber)
      if (clash) return { success: false, error: clash }

      // One transaction, because half of this pair is worse than none of it: an item whose first
      // event failed reads as „nie wiadomo gdzie" forever, and nothing on screen distinguishes that
      // from a genuine gap in the data.
      await withPayloadTransaction(
        payload,
        async (req) => {
          const created = await payload.create({ collection: 'equipment', data: item, req })
          await payload.create({
            collection: 'equipment-events',
            data: {
              equipment: created.id,
              occurredAt,
              holder,
              warehouse,
              serviceProvider,
              investment,
              createdBy: user.id,
            },
            req,
          })
        },
        // The action revalidates both tags itself once the transaction commits; the hooks would
        // otherwise fire from inside it, on writes that may still roll back.
        { skipRevalidation: true },
      )

      return { success: true }
    },
    ['equipment', 'equipmentEvents'],
  )
}

export async function updateEquipmentAction(id: number, data: EquipmentFormDataT) {
  return protectedAction(
    'updateEquipmentAction',
    async ({ payload }) => {
      const parsed = validateAction(equipmentSchema, data)
      if (!parsed.success) return parsed

      const clash = await serialClash(payload, parsed.data.serialNumber, id)
      if (clash) return { success: false, error: clash }

      await payload.update({ collection: 'equipment', id, data: parsed.data })

      return { success: true }
    },
    ['equipment'],
  )
}

export async function transferEquipmentAction(data: EquipmentTransferDataT) {
  return protectedAction(
    'transferEquipmentAction',
    async ({ payload, user }) => {
      const parsed = validateAction(equipmentTransferSchema, data)
      if (!parsed.success) return parsed

      await payload.create({
        collection: 'equipment-events',
        data: { ...parsed.data, createdBy: user.id },
      })

      return { success: true }
    },
    ['equipmentEvents'],
  )
}
