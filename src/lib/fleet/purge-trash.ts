import 'server-only'
import { revalidateTag } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS, EXPIRE_NOW, VEHICLE_DELETE_TAGS } from '@/lib/cache/tags'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectPurgeableVehicleIds } from '@/lib/db/vehicle-trash'
import { deleteTrashedVehicle } from '@/lib/fleet/delete-vehicle-forever'

type PurgeVehicleTrashResultT = {
  purged: number
  failed: number
}

export async function purgeVehicleTrash(
  payload: Payload,
  db: DbExecutorT,
): Promise<PurgeVehicleTrashResultT> {
  const ids = await selectPurgeableVehicleIds(db, ENTITY_TRASH_RETENTION_DAYS)
  const { purgedIds, failed } = await purgeTrashedRows(
    ids,
    (id) => deleteTrashedVehicle(payload, id),
    'purgeVehicleTrash pojazd',
  )

  // Route Handler context — `updateTag` throws here.
  if (purgedIds.length > 0) {
    for (const key of VEHICLE_DELETE_TAGS) revalidateTag(CACHE_TAGS[key], EXPIRE_NOW)
  }

  return { purged: purgedIds.length, failed }
}
