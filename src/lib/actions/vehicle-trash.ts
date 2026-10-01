'use server'

import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { VEHICLE_DELETE_TAGS, VEHICLE_TRASH_TAGS } from '@/lib/cache/tags'
import { isNameConfirmed, NAME_MISMATCH_MESSAGE } from '@/lib/constants/trash'
import { deleteTrashedVehicle } from '@/lib/fleet/delete-vehicle-forever'
import type { ActionResultT } from '@/types/action'

const MISSING_MESSAGE = 'Pojazd nie istnieje.'

// The wrapper expires the tags once; the hooks' own revalidation would fire per write.
const SKIP_HOOK_REVALIDATION = { skipRevalidation: true }

const findVehicle = (payload: Payload, id: number) =>
  payload.findByID({
    collection: 'vehicles',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })

/** No refusal: a car is trashed with its inspections however many it has — the confirm warns. */
export async function trashVehicleAction(vehicleId: number): Promise<ActionResultT> {
  return protectedAction(
    'trashVehicleAction',
    async ({ payload }) => {
      const vehicle = await findVehicle(payload, vehicleId)
      if (!vehicle) return { success: false, error: MISSING_MESSAGE }
      if (vehicle.trashedAt) return { success: true }

      await payload.update({
        collection: 'vehicles',
        id: vehicleId,
        data: { trashedAt: new Date().toISOString() },
        overrideAccess: true,
        context: SKIP_HOOK_REVALIDATION,
      })
      return { success: true }
    },
    [...VEHICLE_TRASH_TAGS],
  )
}

export async function restoreVehicleAction(vehicleId: number): Promise<ActionResultT> {
  return protectedAction(
    'restoreVehicleAction',
    async ({ payload }) => {
      const vehicle = await findVehicle(payload, vehicleId)
      if (!vehicle) return { success: false, error: MISSING_MESSAGE }

      await payload.update({
        collection: 'vehicles',
        id: vehicleId,
        data: { trashedAt: null },
        overrideAccess: true,
        context: SKIP_HOOK_REVALIDATION,
      })
      return { success: true }
    },
    [...VEHICLE_TRASH_TAGS],
  )
}

export async function deleteVehicleForeverAction(
  vehicleId: number,
  confirmName: string,
): Promise<ActionResultT> {
  return protectedAction(
    'deleteVehicleForeverAction',
    async ({ payload }) => {
      const vehicle = await findVehicle(payload, vehicleId)
      if (!vehicle) return { success: false, error: MISSING_MESSAGE }
      if (!isNameConfirmed(confirmName, vehicle.registration)) {
        return { success: false, error: NAME_MISMATCH_MESSAGE }
      }

      const result = await deleteTrashedVehicle(payload, vehicleId)
      return result.ok ? { success: true } : { success: false, error: result.message }
    },
    [...VEHICLE_DELETE_TAGS],
  )
}
