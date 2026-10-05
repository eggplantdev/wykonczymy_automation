import 'server-only'
import type { Payload } from 'payload'
import { LEAD_TRASH_TAGS } from '@/lib/cache/tags'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectPurgeableLeadIds } from '@/lib/db/lead-trash'
import { eraseTrashedLead } from '@/lib/leads/erase-lead'

export async function purgeLeadTrash(payload: Payload, db: DbExecutorT) {
  return purgeTrashedRows({
    ids: await selectPurgeableLeadIds(db, ENTITY_TRASH_RETENTION_DAYS),
    deleteForever: (id) => eraseTrashedLead(payload, id),
    logPrefix: 'purgeLeadTrash zgłoszenie',
    tags: LEAD_TRASH_TAGS,
  })
}
