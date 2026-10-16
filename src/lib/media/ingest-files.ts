import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { BlockedFileError, processUploadFile } from '@/lib/utils/process-upload-file'
import type { CompressionProfileT } from '@/lib/utils/compress-image'

// a batch pick (10-20+ files) each runs main-thread CompressorJS plus a possible ~1.3 MB HEIC WASM
// decode, so an unbounded Promise.all would freeze the UI.
const INGEST_CONCURRENCY = 4

export type IngestOutcomeT = {
  processed: (File | undefined)[]
  blocked: BlockedFileError[]
}

export async function ingestFiles(
  picked: File[],
  profile?: CompressionProfileT,
): Promise<IngestOutcomeT> {
  const blocked: BlockedFileError[] = []
  const processed = await mapWithConcurrency(picked, INGEST_CONCURRENCY, async (file) => {
    try {
      return await processUploadFile(file, profile)
    } catch (error) {
      if (!(error instanceof BlockedFileError)) throw error
      blocked.push(error)
      return undefined
    }
  })
  return { processed, blocked }
}
