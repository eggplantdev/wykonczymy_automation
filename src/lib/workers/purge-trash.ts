import 'server-only'
import { revalidateTag } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS, EXPIRE_NOW, WORKER_DELETE_TAGS } from '@/lib/cache/tags'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectPurgeableWorkerIds } from '@/lib/db/worker-trash'
import { deleteTrashedWorker } from '@/lib/workers/delete-worker-forever'

type PurgeWorkerTrashResultT = {
  purged: number
  blocked: number
  failed: number
}

export async function purgeWorkerTrash(
  payload: Payload,
  db: DbExecutorT,
): Promise<PurgeWorkerTrashResultT> {
  const ids = await selectPurgeableWorkerIds(db, ENTITY_TRASH_RETENTION_DAYS)
  const { purgedIds, blocked, failed } = await purgeTrashedRows(
    ids,
    (id) => deleteTrashedWorker(payload, id),
    'purgeWorkerTrash pracownik',
  )

  // Route Handler context — `updateTag` throws here.
  if (purgedIds.length > 0) {
    for (const key of WORKER_DELETE_TAGS) revalidateTag(CACHE_TAGS[key], EXPIRE_NOW)
  }

  return { purged: purgedIds.length, blocked, failed }
}
