import 'server-only'
import type { Payload } from 'payload'
import { WORKER_DELETE_TAGS } from '@/lib/cache/tags'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectPurgeableWorkerIds } from '@/lib/db/worker-trash'
import { deleteTrashedWorker } from '@/lib/workers/delete-worker-forever'

export async function purgeWorkerTrash(payload: Payload, db: DbExecutorT) {
  return purgeTrashedRows({
    ids: await selectPurgeableWorkerIds(db, ENTITY_TRASH_RETENTION_DAYS),
    deleteForever: (id) => deleteTrashedWorker(payload, id),
    logPrefix: 'purgeWorkerTrash pracownik',
    tags: WORKER_DELETE_TAGS,
  })
}
