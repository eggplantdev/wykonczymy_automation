// Single processing step at ingest: classify → route (HEIC-convert / compress / passthrough) →
// rewrite → size-guard. Both consumers (scan-extraction and submit-upload) read the processed
// File from the shared map, so compression happens exactly once. The browser decoders are
// injected (ProcessUploadDepsT) so this orchestration is unit-testable without CompressorJS/heic-to.

// The Vercel request-body hard cap is 4.5 MB (413 FUNCTION_PAYLOAD_TOO_LARGE, uncatchable in-function).
// Guard well below it so the multipart boundary + other form fields still fit under the platform cap.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export type BlockedReasonT = 'too-large' | 'heic-unconvertible'

export class BlockedFileError extends Error {
  readonly reason: BlockedReasonT
  readonly filename: string
  readonly size?: number

  constructor(reason: BlockedReasonT, filename: string, size?: number) {
    super(`${filename}: ${reason}`)
    this.name = 'BlockedFileError'
    this.reason = reason
    this.filename = filename
    this.size = size
  }
}

export type ProcessUploadDepsT = {
  /** Resize/re-encode a jpeg/png client-side (CompressorJS). */
  compressImage: (file: File) => Promise<File>
  /** Decode + resize a HEIC/HEIF into a JPEG File; throws if the browser can't decode it. */
  convertHeicToJpeg: (file: File) => Promise<File>
}

const HEIC_EXTENSIONS = ['.heic', '.heif']
const IMAGE_EXTENSIONS = [
  ...HEIC_EXTENSIONS,
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tiff',
]

function hasExtension(name: string, extensions: string[]): boolean {
  const lower = name.toLowerCase()
  return extensions.some((ext) => lower.endsWith(ext))
}

// Chrome/Firefox often report an empty File.type for HEIC, so classification can't rely on MIME
// alone — the extension is the fallback signal (the bug behind the current raw-HEIC passthrough).
function isImageFile(file: File): boolean {
  const mimeIsImage = file.type.startsWith('image/') && !file.type.includes('svg')
  return mimeIsImage || hasExtension(file.name, IMAGE_EXTENSIONS)
}

function isHeicFile(file: File): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    hasExtension(file.name, HEIC_EXTENSIONS)
  )
}

function renameToJpg(name: string): string {
  return name.replace(/\.(heic|heif)$/i, '.jpg')
}

const defaultDeps: ProcessUploadDepsT = {
  compressImage: (file) => import('@/lib/utils/compress-image').then((m) => m.compressImage(file)),
  // TODO(EX-457): /10x-implement wires the real Safari-native → heic-to WASM decoder here (Phase 2).
  convertHeicToJpeg: async () => {
    throw new Error('HEIC decoder not wired')
  },
}

function guardSize(file: File): File {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BlockedFileError('too-large', file.name, file.size)
  }
  return file
}

export async function processUploadFile(
  file: File,
  deps: ProcessUploadDepsT = defaultDeps,
): Promise<File> {
  if (!isImageFile(file)) return guardSize(file)

  if (isHeicFile(file)) {
    let jpeg: File
    try {
      jpeg = await deps.convertHeicToJpeg(file)
    } catch {
      throw new BlockedFileError('heic-unconvertible', file.name)
    }
    const renamed = new File([jpeg], renameToJpg(file.name), { type: 'image/jpeg' })
    return guardSize(renamed)
  }

  return guardSize(await deps.compressImage(file))
}
