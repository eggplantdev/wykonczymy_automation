'use server'

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

export async function createEquipmentAction(data: AddEquipmentDataT) {
  return protectedAction(
    'createEquipmentAction',
    async ({ payload, user }) => {
      const parsed = validateAction(addEquipmentSchema, data)
      if (!parsed.success) return parsed

      const { occurredAt, holder, warehouse, serviceProvider, investment, ...item } = parsed.data

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
