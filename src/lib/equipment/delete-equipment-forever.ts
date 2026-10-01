import 'server-only'
import type { Payload } from 'payload'
import type { DeleteForeverResultT } from '@/types/trash'
import { logError } from '@/lib/utils/log-error'

const EQUIPMENT_NOT_TRASHED_MESSAGE = 'Najpierw przenieś sprzęt do kosza.'

/**
 * No refusal branch: nothing outside the register points at an item, and its handovers go with it.
 * The DB cascade removes them without firing a Payload hook, so cache expiry is each caller's job.
 */
export async function deleteTrashedEquipment(
  payload: Payload,
  equipmentId: number,
): Promise<DeleteForeverResultT> {
  try {
    const item = await payload.findByID({
      collection: 'equipment',
      id: equipmentId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })
    if (!item?.trashedAt) {
      return { ok: false, reason: 'not-trashed', message: EQUIPMENT_NOT_TRASHED_MESSAGE }
    }

    await payload.delete({
      collection: 'equipment',
      id: equipmentId,
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    return { ok: true }
  } catch (err) {
    logError(`[deleteTrashedEquipment] ${equipmentId}`, err)
    return { ok: false, reason: 'error', message: 'Nie udało się usunąć sprzętu.' }
  }
}
