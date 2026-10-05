'use server'

import { requireAuth } from '@/lib/auth/require-auth'
import { isManagementRole, ROLES } from '@/lib/auth/roles'
import { runAuthorizedHandler } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { filterMediaUploadedBy } from '@/lib/db/media-ownership'
import { reclaimUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'

/**
 * Delete media that ended up attached to nothing. The add form uploads every page before it creates
 * the expense, so a create that fails afterwards leaves those files in Blob with no row pointing at
 * them — unreachable and unbilled-for forever.
 *
 * The ids come from the client, so nothing here may take them at their word: the reclaim
 * re-checks each one against the join table and skips anything still attached. Without that, this
 * exported action is an endpoint that erases any invoice page in the database by id.
 *
 * A worker's expense draft fails the same way, so every role may call it — but outside management
 * only on files the caller uploaded: an unattached file of someone else's may be a page their own
 * form is about to save.
 */
export async function deleteOrphanedMediaAction(mediaIds: number[]) {
  const session = await requireAuth(ROLES)
  if (!session.success) return { success: false, error: session.error }
  const { user } = session

  return runAuthorizedHandler(
    `deleteOrphanedMediaAction count=${mediaIds.length}`,
    async (payload) => {
      const ids = isManagementRole(user.role)
        ? mediaIds
        : await filterMediaUploadedBy(await getDb(payload), mediaIds, user.id)
      await reclaimUnreferencedMedia(payload, ids)
      return { success: true }
    },
  )
}
