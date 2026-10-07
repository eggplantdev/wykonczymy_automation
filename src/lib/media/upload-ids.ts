import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { uploadMediaFromClient } from '@/lib/media/client-upload'
import { UploadRefusedError } from '@/lib/media/upload-refused'
import { translate } from '@/lib/i18n/translations'
import type { MediaKindT } from '@/types/media'

// Cap parallel uploads to match the receipt-generation path (GENERATION_CONCURRENCY): batch-add lets a user
// attach 10-20+ receipts, and submitting them all at once would fire that many simultaneous upload requests.
// Bounds files in flight on either path: Blob PUTs on the browser-to-Blob one (`createMediaRow`
// serializes its row creates itself), whole route calls on the fast one.
const UPLOAD_CONCURRENCY = 4

export const UPLOAD_FAILED = translate('pl', 'notices', 'uploadFailed')

export type MediaUploaderT = (file: File, data?: { kind?: MediaKindT }) => Promise<number>

/**
 * Thrown when any page of a submit fails to upload. Carries the ids that DID land, because those
 * files are already in Blob with nothing referencing them — the caller has to hand them to the
 * orphan cleanup or they leak. Multi-page submits made this the common failure, not the rare one.
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
 * Positional mediaId lists for submit. Per row index: upload every attached file in order; a row
 * with no files gets an empty list. The concurrency cap bounds total files in flight rather than
 * rows — one row can carry a whole multi-page invoice on its own.
 *
 * A failure throws `MediaUploadError` carrying whatever already landed. Failures are caught per
 * page rather than propagated out of `mapWithConcurrency`, because that call rejects on the first
 * one while its other workers keep going — the ids they produce afterwards would be unrecoverable.
 */
export async function resolveUploadIdRows(
  count: number,
  files: Map<number, File[]>,
  upload: (file: File) => Promise<number> = uploadMediaFromClient,
): Promise<number[][]> {
  const pages = Array.from({ length: count }, (_, row) =>
    (files.get(row) ?? []).map((file) => ({ row, file })),
  ).flat()

  let failure: UploadRefusedError | undefined
  const mediaIds = await mapWithConcurrency(pages, UPLOAD_CONCURRENCY, async ({ file }) => {
    // Once one page is lost the submit is doomed, so don't spend the user's bandwidth (and Blob
    // storage) uploading the rest of a 20-page batch just to delete it again.
    if (failure) return undefined
    try {
      return await upload(file)
    } catch (err) {
      // A failed request or the Blob SDK speaks English; only a refusal is worded for the user.
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

/**
 * The same upload, from a surface that has no rows — one set of files, in pick order. Spares
 * every such caller the `(1, new Map([[0, files]]))` incantation and the `[pages]` destructure.
 */
export async function resolveUploadIds(
  files: File[],
  kind?: MediaKindT,
  upload: MediaUploaderT = uploadMediaFromClient,
): Promise<number[]> {
  const [pages] = await resolveUploadIdRows(
    1,
    new Map([[0, files]]),
    kind ? (file) => upload(file, { kind }) : upload,
  )
  return pages
}
