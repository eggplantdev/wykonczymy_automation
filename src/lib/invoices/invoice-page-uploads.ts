import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { uploadMediaFromClient } from '@/lib/media/client-upload'
import type { MediaKindT } from '@/types/media'

// Serial on purpose: on Neon, concurrent `POST /api/media` calls each return an id but only one row
// commits ("Failed to persist upload data … NotFound"), so the bulk insert then fails its media FK.
// Stopgap — only the row-create has to be serial; the Blob PUT could stay parallel.
const UPLOAD_CONCURRENCY = 1

/**
 * Thrown when any page of a submit fails to upload. Carries the ids that DID land, because those
 * files are already in Blob with nothing referencing them — the caller has to hand them to the
 * orphan cleanup or they leak. Multi-page submits made this the common failure, not the rare one.
 */
export class InvoiceUploadError extends Error {
  constructor(
    message: string,
    readonly uploadedIds: number[],
  ) {
    super(message)
    this.name = 'InvoiceUploadError'
  }
}

/**
 * Positional invoice-mediaId lists for submit. Per row index: upload every attached page in order;
 * a row with no files gets an empty list. The concurrency cap bounds total files in flight rather
 * than rows — one row can now carry a whole multi-page invoice on its own. `upload` is injectable
 * for tests.
 *
 * A failure throws `InvoiceUploadError` carrying whatever already landed. Failures are caught per
 * page rather than propagated out of `mapWithConcurrency`, because that call rejects on the first
 * one while its other workers keep going — the ids they produce afterwards would be unrecoverable.
 */
export async function resolveInvoiceMediaIds(
  count: number,
  files: Map<number, File[]>,
  upload: (file: File) => Promise<number> = uploadMediaFromClient,
): Promise<number[][]> {
  const pages = Array.from({ length: count }, (_, row) =>
    (files.get(row) ?? []).map((file) => ({ row, file })),
  ).flat()

  let failure: string | undefined
  const mediaIds = await mapWithConcurrency(pages, UPLOAD_CONCURRENCY, async ({ file }) => {
    // Once one page is lost the submit is doomed, so don't spend the user's bandwidth (and Blob
    // storage) uploading the rest of a 20-page batch just to delete it again.
    if (failure) return undefined
    try {
      return await upload(file)
    } catch (err) {
      failure ??= err instanceof Error ? err.message : 'Nie udało się przesłać plików'
      return undefined
    }
  })

  if (failure) {
    throw new InvoiceUploadError(
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
 * The same upload, from a surface that has no rows — one invoice, its pages in pick order. Spares
 * every such caller the `(1, new Map([[0, files]]))` incantation and the `[pages]` destructure.
 */
export async function resolveInvoicePageIds(files: File[], kind?: MediaKindT): Promise<number[]> {
  const [pages] = await resolveInvoiceMediaIds(
    1,
    new Map([[0, files]]),
    kind && ((file) => uploadMediaFromClient(file, { kind })),
  )
  return pages
}
