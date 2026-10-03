'use server'

import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { EQUIPMENT_DELETE_TAGS, EQUIPMENT_TRASH_TAGS } from '@/lib/cache/tags'
import { isNameConfirmed, NAME_MISMATCH_MESSAGE } from '@/lib/constants/trash'
import { deleteTrashedEquipment } from '@/lib/equipment/delete-equipment-forever'
import type { ActionResultT } from '@/types/action'

const MISSING_MESSAGE = 'Sprzęt nie istnieje.'

// The wrapper expires the tags once; the hooks' own revalidation would fire per write.
const SKIP_HOOK_REVALIDATION = { skipRevalidation: true }

const findItem = (payload: Payload, id: number) =>
  payload.findByID({
    collection: 'equipment',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })

/** No refusal: an item is trashed wherever it is and whoever holds it — the confirm warns. */
export async function trashEquipmentAction(equipmentId: number): Promise<ActionResultT> {
  return protectedAction(
    'trashEquipmentAction',
    async ({ payload }) => {
      const item = await findItem(payload, equipmentId)
      if (!item) return { success: false, error: MISSING_MESSAGE }
      if (item.trashedAt) return { success: true }

      await payload.update({
        collection: 'equipment',
        id: equipmentId,
        data: { trashedAt: new Date().toISOString() },
        overrideAccess: true,
        context: SKIP_HOOK_REVALIDATION,
      })
      return { success: true }
    },
    [...EQUIPMENT_TRASH_TAGS],
  )
}

export async function restoreEquipmentAction(equipmentId: number): Promise<ActionResultT> {
  return protectedAction(
    'restoreEquipmentAction',
    async ({ payload }) => {
      const item = await findItem(payload, equipmentId)
      if (!item) return { success: false, error: MISSING_MESSAGE }

      await payload.update({
        collection: 'equipment',
        id: equipmentId,
        data: { trashedAt: null },
        overrideAccess: true,
        context: SKIP_HOOK_REVALIDATION,
      })
      return { success: true }
    },
    [...EQUIPMENT_TRASH_TAGS],
  )
}

export async function deleteEquipmentForeverAction(
  equipmentId: number,
  confirmName: string,
): Promise<ActionResultT> {
  return protectedAction(
    'deleteEquipmentForeverAction',
    async ({ payload }) => {
      const item = await findItem(payload, equipmentId)
      if (!item) return { success: false, error: MISSING_MESSAGE }
      if (!isNameConfirmed(confirmName, item.name)) {
        return { success: false, error: NAME_MISMATCH_MESSAGE }
      }

      const result = await deleteTrashedEquipment(payload, equipmentId)
      return result.ok ? { success: true } : { success: false, error: result.message }
    },
    [...EQUIPMENT_DELETE_TAGS],
  )
}
