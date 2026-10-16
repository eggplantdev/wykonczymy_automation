'use server'

import { isManagementRole } from '@/lib/auth/roles'
import { sessionAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { filterMediaUploadedBy } from '@/lib/db/media-ownership'
import { reclaimUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'

/**
 * outside management
 * only on files the caller uploaded: an unattached file of someone else's may be a page their own
 * form is about to save.
 */
export async function deleteOrphanedMediaAction(mediaIds: number[]) {
  return sessionAction(
    `deleteOrphanedMediaAction count=${mediaIds.length}`,
    async ({ payload, user }) => {
      const ids = isManagementRole(user.role)
        ? mediaIds
        : await filterMediaUploadedBy(await getDb(payload), mediaIds, user.id)
      await reclaimUnreferencedMedia(payload, ids)
      return { success: true }
    },
  )
}
