import 'server-only'
import { revalidateTag } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS, EQUIPMENT_DELETE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectPurgeableEquipmentIds } from '@/lib/db/equipment-trash'
import { deleteTrashedEquipment } from '@/lib/equipment/delete-equipment-forever'

type PurgeEquipmentTrashResultT = {
  purged: number
  failed: number
}

export async function purgeEquipmentTrash(
  payload: Payload,
  db: DbExecutorT,
): Promise<PurgeEquipmentTrashResultT> {
  const ids = await selectPurgeableEquipmentIds(db, ENTITY_TRASH_RETENTION_DAYS)
  const { purgedIds, failed } = await purgeTrashedRows(
    ids,
    (id) => deleteTrashedEquipment(payload, id),
    'purgeEquipmentTrash sprzęt',
  )

  // Route Handler context — `updateTag` throws here.
  if (purgedIds.length > 0) {
    for (const key of EQUIPMENT_DELETE_TAGS) revalidateTag(CACHE_TAGS[key], EXPIRE_NOW)
  }

  return { purged: purgedIds.length, failed }
}
