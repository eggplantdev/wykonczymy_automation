import type { Payload } from 'payload'
import { FILE_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import type { DbExecutorT } from '@/lib/db/get-db'
import {
  closeReferencedDetachments,
  recordUnreferencedMedia,
  selectExpiredDetachedMediaIds,
} from '@/lib/db/media-detachments'
import { logError } from '@/lib/utils/log-error'

// The cap keeps a backlog night inside the cron's 300 s.
const MAX_DELETES_PER_RUN = 100

/** Counts references, so a file a cascade left behind enters the trash here. */
export async function gcMedia(
  payload: Payload,
  db: DbExecutorT,
): Promise<{ recorded: number; healed: number; deleted: number; failed: number }> {
  const recorded = await recordUnreferencedMedia(db)
  const healed = await closeReferencedDetachments(db)
  const expired = await selectExpiredDetachedMediaIds(
    db,
    FILE_TRASH_RETENTION_DAYS,
    MAX_DELETES_PER_RUN,
  )

  let deleted = 0
  let failed = 0
  // Serial on purpose: parallel Payload deletes on Neon share one session — each reports success, one commits.
  for (const mediaId of expired) {
    try {
      await payload.delete({ collection: 'media', id: mediaId })
      deleted++
    } catch (err) {
      failed++
      logError(`[media] gc delete of media ${mediaId} failed`, err)
    }
  }

  return { recorded, healed, deleted, failed }
}
