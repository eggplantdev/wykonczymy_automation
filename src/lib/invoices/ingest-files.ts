import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'
import { BlockedFileError, processUploadFile } from '@/lib/utils/process-upload-file'
import type { CompressionProfileT } from '@/lib/utils/compress-image'

// Cap parallel ingest processing to match the scan (GENERATION_CONCURRENCY) and upload
// (UPLOAD_CONCURRENCY) paths: a batch pick (10-20+ files) each runs main-thread CompressorJS
// plus a possible ~1.3 MB HEIC WASM decode, so an unbounded Promise.all would freeze the UI.
const INGEST_CONCURRENCY = 4

export type IngestOutcomeT = {
  /** Positional: `processed[i]` is `picked[i]` after ingest, or `undefined` if it was blocked. */
  processed: (File | undefined)[]
  blocked: BlockedFileError[]
}

/**
 * Blocked files are collected rather than thrown so one bad file in a batch never discards the
 * others. Shared by both pick surfaces — the expense form's rows and the transfers table's invoice
 * cell — because a file that fails from one must fail the same way from the other.
 */
export async function ingestFiles(
  picked: File[],
  profile: CompressionProfileT = 'INVOICE',
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
