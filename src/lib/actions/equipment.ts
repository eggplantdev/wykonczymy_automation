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
import { uniqueClash } from '@/lib/trash/unique-holder'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { protectedAction, validateAction } from './run-action'

export async function createEquipmentAction(data: AddEquipmentDataT) {
  return protectedAction(
    'createEquipmentAction',
    async ({ payload, user }) => {
      const parsed = validateAction(addEquipmentSchema, data)
      if (!parsed.success) return parsed

      const { occurredAt, holder, warehouse, serviceProvider, investment, ...item } = parsed.data

      const clash = await uniqueClash(payload, {
        collection: 'equipment',
        field: 'serialNumber',
        value: item.serialNumber,
        subject: `Sprzęt o numerze seryjnym ${item.serialNumber}`,
      })
      if (clash) return { success: false, error: clash }

      // an item whose first
      // event failed reads as „nie wiadomo gdzie" forever
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

      const clash = await uniqueClash(payload, {
        collection: 'equipment',
        field: 'serialNumber',
        value: parsed.data.serialNumber,
        ownId: id,
        subject: `Sprzęt o numerze seryjnym ${parsed.data.serialNumber}`,
      })
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
