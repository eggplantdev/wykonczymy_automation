import { ingestFiles } from '@/lib/media/ingest-files'
import type { BlockedFileError } from '@/lib/utils/process-upload-file'
import type { CompressionProfileT } from '@/lib/utils/compress-image'

export type PickedIngestT = {
  files: File[]
  blocked: BlockedFileError[]
}

export async function ingestPickedFiles(
  picked: File[],
  profile?: CompressionProfileT,
): Promise<PickedIngestT> {
  const { processed, blocked } = await ingestFiles(picked, profile)
  return { files: processed.filter((file) => file !== undefined), blocked }
}
