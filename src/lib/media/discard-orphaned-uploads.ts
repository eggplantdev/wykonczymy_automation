import { deleteOrphanedMediaAction } from '@/lib/actions/delete-orphaned-media'
import { logError } from '@/lib/utils/log-error'

/**
 * Hand back files that were uploaded for a submit that then failed. Fire-and-forget on purpose —
 * the user is already looking at a failed submit and cleanup is not their problem — but with a
 * `.catch`, since a transport-level failure of the action would otherwise surface as an unhandled
 * rejection at exactly that moment.
 */
export function discardOrphanedUploads(mediaIds: number[]) {
  if (mediaIds.length === 0) return
  void deleteOrphanedMediaAction(mediaIds).catch((err) =>
    logError('[media] orphan cleanup failed', err),
  )
}
