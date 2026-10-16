import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { uploadMediaBySize } from '@/lib/media/upload-media'
import { UploadRefusedError } from '@/lib/media/upload-refused'
import { translate } from '@/lib/i18n/translations'
import type { MediaKindT } from '@/types/media'

const UPLOAD_CONCURRENCY = 4

export const UPLOAD_FAILED = translate('pl', 'notices', 'uploadFailed')

/**
 * Carries the ids that DID land, because those files are already in Blob with nothing referencing
 * them — the caller has to hand them to the orphan cleanup or they leak.
 */
export class MediaUploadError extends Error {
  constructor(
    readonly refusal: UploadRefusedError,
    readonly uploadedIds: number[],
  ) {
    super(refusal.message)
    this.name = 'MediaUploadError'
  }
}

/**
 * Failures are caught per page rather than propagated out of `mapWithConcurrency`, because that call
 * rejects on the first one while its other workers keep going — the ids they produce afterwards
 * would be unrecoverable.
 */
export async function resolveUploadIdRows(
  count: number,
  files: Map<number, File[]>,
  kind?: MediaKindT,
): Promise<number[][]> {
  const pages = Array.from({ length: count }, (_, row) =>
    (files.get(row) ?? []).map((file) => ({ row, file })),
  ).flat()

  let failure: UploadRefusedError | undefined
  const mediaIds = await mapWithConcurrency(pages, UPLOAD_CONCURRENCY, async ({ file }) => {
    if (failure) return undefined
    try {
      return await uploadMediaBySize(file, kind)
    } catch (err) {
      failure ??=
        err instanceof UploadRefusedError
          ? err
          : new UploadRefusedError(UPLOAD_FAILED, 'uploadFailed')
      return undefined
    }
  })

  if (failure) {
    throw new MediaUploadError(
      failure,
      mediaIds.filter((id): id is number => id !== undefined),
    )
  }

  const byRow: number[][] = Array.from({ length: count }, () => [])
  pages.forEach(({ row }, offset) => {
    const mediaId = mediaIds[offset]
    if (mediaId !== undefined) byRow[row].push(mediaId)
  })
  return byRow
}
