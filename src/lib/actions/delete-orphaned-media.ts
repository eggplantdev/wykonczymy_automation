'use server'

import { protectedAction } from './run-action'
import { reclaimUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'

/**
 * Delete media that ended up attached to nothing. The add form uploads every page before it creates
 * the expense, so a create that fails afterwards leaves those files in Blob with no row pointing at
 * them — unreachable and unbilled-for forever.
 *
 * The ids come from the client, so nothing here may take them at their word: the reclaim
 * re-checks each one against the join table and skips anything still attached. Without that, this
 * exported action is an endpoint that erases any invoice page in the database by id.
 */
export async function deleteOrphanedMediaAction(mediaIds: number[]) {
  return protectedAction(
    `deleteOrphanedMediaAction count=${mediaIds.length}`,
    async ({ payload }) => {
      await reclaimUnreferencedMedia(payload, mediaIds)
      return { success: true }
    },
  )
}
