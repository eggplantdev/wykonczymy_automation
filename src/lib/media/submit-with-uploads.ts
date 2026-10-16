import { discardOrphanedUploads } from '@/lib/media/discard-orphaned-uploads'
import { MediaUploadError, UPLOAD_FAILED, resolveUploadIdRows } from '@/lib/media/upload-ids'
import type { ActionResultT, FailureT } from '@/types/action'
import type { MediaKindT } from '@/types/media'

/**
 * Files land in Blob before the row that references them exists, so every path where the mutation
 * does not attach them must hand them back — Blob has no undelete.
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

export function submitWithUploadRows(
  rowCount: number,
  files: Map<number, File[]>,
  submit: (uploadedIdRows: number[][] | undefined) => Promise<ActionResultT>,
  existingIdOf: (file: File) => number | undefined = () => undefined,
): Promise<ActionResultT> {
  const newFiles = new Map(
    [...files]
      .map(
        ([row, rowFiles]) =>
          [row, rowFiles.filter((file) => existingIdOf(file) === undefined)] as const,
      )
      .filter(([, rowFiles]) => rowFiles.length > 0),
  )
  const linkRows = (uploadedRows: number[][]) =>
    Array.from({ length: rowCount }, (_, row) => {
      const uploaded = [...(uploadedRows[row] ?? [])]
      return (files.get(row) ?? []).flatMap((file) => existingIdOf(file) ?? uploaded.shift() ?? [])
    })

  if (newFiles.size === 0) return submit(files.size === 0 ? undefined : linkRows([]))
  return withOrphanCleanup(
    () => resolveUploadIdRows(rowCount, newFiles),
    (rows) => rows.flat(),
    (rows) => submit(linkRows(rows)),
  )
}
