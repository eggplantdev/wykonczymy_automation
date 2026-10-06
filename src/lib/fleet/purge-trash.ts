import 'server-only'
import type { Payload } from 'payload'
import { VEHICLE_DELETE_TAGS } from '@/lib/cache/tags'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectPurgeableVehicleIds } from '@/lib/db/vehicle-trash'
import { deleteTrashedVehicle } from '@/lib/fleet/delete-vehicle-forever'

export async function purgeVehicleTrash(payload: Payload, db: DbExecutorT) {
  return purgeTrashedRows({
    ids: await selectPurgeableVehicleIds(db, ENTITY_TRASH_RETENTION_DAYS),
    deleteForever: (id) => deleteTrashedVehicle(payload, id),
    logPrefix: 'purgeVehicleTrash pojazd',
    tags: VEHICLE_DELETE_TAGS,
  })
}
