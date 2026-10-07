import { discardOrphanedUploads } from '@/lib/media/discard-orphaned-uploads'
import { MediaUploadError, UPLOAD_FAILED, resolveUploadIdRows } from '@/lib/media/upload-ids'
import type { ActionResultT, FailureT } from '@/types/action'
import type { MediaKindT } from '@/types/media'

/**
 * Files land in Blob before the row that references them exists, so every path where the mutation
 * does not attach them must hand them back — Blob has no undelete. A throw from the mutation is
 * re-thrown rather than folded into a failure result, so the caller still sees it as a throw.
 */
async function withOrphanCleanup<TIds, TResult extends ActionResultT<unknown> | ActionResultT>(
  resolve: () => Promise<TIds>,
  flatten: (ids: TIds) => number[],
  submit: (ids: TIds) => Promise<TResult>,
): Promise<TResult | FailureT> {
  let ids: TIds
  try {
    ids = await resolve()
  } catch (err) {
    // Only the upload error phrases itself for this UI; anything else is transport or a
    // chunk-load failure, whose message is not something to put in front of the user.
    if (!(err instanceof MediaUploadError)) {
      return { success: false, error: UPLOAD_FAILED, messageKey: 'uploadFailed' }
    }
    discardOrphanedUploads(err.uploadedIds)
    return {
      success: false,
      error: err.message,
      messageKey: err.refusal.messageKey,
      messageParams: err.refusal.messageParams,
    }
  }

  let result: TResult
  try {
    result = await submit(ids)
  } catch (err) {
    discardOrphanedUploads(flatten(ids))
    throw err
  }
  if (!result.success) discardOrphanedUploads(flatten(ids))
  return result
}

export function submitWithUploads<TResult extends ActionResultT<unknown> | ActionResultT>(
  files: File[],
  submit: (uploadedIds: number[]) => Promise<TResult>,
  kind?: MediaKindT,
): Promise<TResult | FailureT> {
  if (files.length === 0) return submit([])
  return withOrphanCleanup(
    async () => (await resolveUploadIdRows(1, new Map([[0, files]]), kind))[0],
    (ids) => ids,
    submit,
  )
}

/** Files per line-item row, positional — `rows[i]` are the files of `lineItems[i]`. */
export function submitWithUploadRows(
  rowCount: number,
  files: Map<number, File[]>,
  submit: (uploadedIdRows: number[][] | undefined) => Promise<ActionResultT>,
): Promise<ActionResultT> {
  if (files.size === 0) return submit(undefined)
  return withOrphanCleanup(
    () => resolveUploadIdRows(rowCount, files),
    (rows) => rows.flat(),
    submit,
  )
}
