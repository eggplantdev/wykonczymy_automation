import 'server-only'
import type { Payload } from 'payload'
import { EQUIPMENT_DELETE_TAGS } from '@/lib/cache/tags'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import { selectPurgeableEquipmentIds } from '@/lib/db/equipment-trash'
import type { DbExecutorT } from '@/lib/db/get-db'
import { deleteTrashedEquipment } from '@/lib/equipment/delete-equipment-forever'

export async function purgeEquipmentTrash(payload: Payload, db: DbExecutorT) {
  return purgeTrashedRows({
    ids: await selectPurgeableEquipmentIds(db, ENTITY_TRASH_RETENTION_DAYS),
    deleteForever: (id) => deleteTrashedEquipment(payload, id),
    logPrefix: 'purgeEquipmentTrash sprzęt',
    tags: EQUIPMENT_DELETE_TAGS,
  })
}
