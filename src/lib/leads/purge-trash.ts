import 'server-only'
import { revalidateTag } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS, EXPIRE_NOW, LEAD_TRASH_TAGS } from '@/lib/cache/tags'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectPurgeableLeadIds } from '@/lib/db/lead-trash'
import { eraseTrashedLead } from '@/lib/leads/erase-lead'

type PurgeLeadTrashResultT = {
  purged: number
  failed: number
}

export async function purgeLeadTrash(
  payload: Payload,
  db: DbExecutorT,
): Promise<PurgeLeadTrashResultT> {
  const ids = await selectPurgeableLeadIds(db, ENTITY_TRASH_RETENTION_DAYS)
  const { purgedIds, failed } = await purgeTrashedRows(
    ids,
    (id) => eraseTrashedLead(payload, id),
    'purgeLeadTrash zgłoszenie',
  )

  // Route Handler context — `updateTag` throws here.
  if (purgedIds.length > 0) {
    for (const key of LEAD_TRASH_TAGS) revalidateTag(CACHE_TAGS[key], EXPIRE_NOW)
  }

  return { purged: purgedIds.length, failed }
}
