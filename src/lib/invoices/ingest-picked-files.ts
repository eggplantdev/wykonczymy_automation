import { ingestFiles } from '@/lib/invoices/ingest-files'
import type { BlockedFileError } from '@/lib/utils/process-upload-file'
import type { CompressionProfileT } from '@/lib/utils/compress-image'

export type PickedIngestT = {
  /** Survivors in pick order — an invoice's pages, minus whatever was blocked. */
  files: File[]
  blocked: BlockedFileError[]
}

/**
 * Ingest a whole pick as one invoice's pages. `ingestFiles` answers POSITIONALLY — `processed[i]`
 * is `undefined` where file `i` was blocked — which only the row-keyed expense form needs, to pair
 * each page against a stable row id. A surface with no rows wants the survivors compacted, so that
 * compaction lives here instead of being re-derived at every such call site.
 */
export async function ingestPickedFiles(
  picked: File[],
  profile?: CompressionProfileT,
): Promise<PickedIngestT> {
  const { processed, blocked } = await ingestFiles(picked, profile)
  return { files: processed.filter((file) => file !== undefined), blocked }
}
