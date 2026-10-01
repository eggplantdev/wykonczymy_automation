import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import type { DeleteForeverResultT } from '@/types/trash'
import { logError } from '@/lib/utils/log-error'

export const VEHICLE_NOT_TRASHED_MESSAGE = 'Najpierw przenieś pojazd do kosza.'

/**
 * No refusal branch: nothing outside the fleet points at a vehicle, and its inspections go with it.
 * The DB cascade removes them without firing a Payload hook, so cache expiry is each caller's job.
 */
export async function deleteTrashedVehicle(
  payload: Payload,
  vehicleId: number,
  req?: PayloadRequest,
): Promise<DeleteForeverResultT> {
  try {
    const vehicle = await payload.findByID({
      collection: 'vehicles',
      id: vehicleId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })
    if (!vehicle?.trashedAt) {
      return { ok: false, reason: 'not-trashed', message: VEHICLE_NOT_TRASHED_MESSAGE }
    }

    await payload.delete({
      collection: 'vehicles',
      id: vehicleId,
      overrideAccess: true,
      context: { skipRevalidation: true },
      req,
    })
    return { ok: true }
  } catch (err) {
    logError(`[deleteTrashedVehicle] ${vehicleId}`, err)
    return { ok: false, reason: 'error', message: 'Nie udało się usunąć pojazdu.' }
  }
}
