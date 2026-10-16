import { deleteOrphanedMediaAction } from '@/lib/actions/delete-orphaned-media'
import { logError } from '@/lib/utils/log-error'

export function discardOrphanedUploads(mediaIds: number[]) {
  if (mediaIds.length === 0) return
  void deleteOrphanedMediaAction(mediaIds).catch((err) =>
    logError('[media] orphan cleanup failed', err),
  )
}
