import type { CompressionProfileT } from '@/lib/utils/compress-image'

// Both consumers (scan-extraction and submit-upload) read the processed File from the shared map,
// so compression happens exactly once. The browser decoders are injected (ProcessUploadDepsT) so
// this orchestration is unit-testable without CompressorJS/heic-to.

export class BlockedFileError extends Error {
  readonly filename: string

  constructor(filename: string) {
    super(`${filename}: heic-unconvertible`)
    this.name = 'BlockedFileError'
    this.filename = filename
  }
}

export type ProcessUploadDepsT = {
  /** Resize/re-encode a jpeg/png client-side (CompressorJS). */
  compressImage: (file: File) => Promise<File>
  /** Decode + resize a HEIC/HEIF into a JPEG File; throws if the browser can't decode it. */
  convertHeicToJpeg: (file: File) => Promise<File>
}

// Near-lossless on purpose: this pass only has to DECODE. The compressImage right after it is what
// sets the real quality, so decoding at the profile's quality too meant every non-Safari HEIC was
// compressed twice — and the scan-extraction consumer reads these bytes, so the second pass came
// out of OCR accuracy.
const HEIC_DECODE_QUALITY = 0.92

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

function defaultDeps(profile?: CompressionProfileT): ProcessUploadDepsT {
  return {
    compressImage: (file) =>
      import('@/lib/utils/compress-image').then((m) => m.compressImage(file, profile)),
    // Native-first: Safari's canvas decodes HEIC via the OS HEVC codec, so CompressorJS with jpeg
    // output both decodes and resizes in one pass. Chrome/Firefox can't decode HEIC on canvas →
    // CompressorJS rejects → fall back to the lazy WASM decoder (heic-to, ~1.3 MB, only pulled when
    // a HEIC is actually picked on a non-Safari browser), then resize the JPEG. Any throw here
    // becomes a BlockedFileError in processUploadFile.
    convertHeicToJpeg: async (file) => {
      const { compressToJpeg, compressImage } = await import('@/lib/utils/compress-image')
      try {
        return await compressToJpeg(file, profile)
      } catch {
        const { heicTo } = await import('heic-to')
        const converted = await heicTo({
          blob: file,
          type: 'image/jpeg',
          quality: HEIC_DECODE_QUALITY,
        })
        if (!(converted instanceof Blob)) throw new Error('heic-to did not return a JPEG blob')
        return compressImage(new File([converted], file.name, { type: 'image/jpeg' }), profile)
      }
    },
  }
}

export async function processUploadFile(
  file: File,
  profile?: CompressionProfileT,
  deps: ProcessUploadDepsT = defaultDeps(profile),
): Promise<File> {
  if (!isImageFile(file)) return file

  if (isHeicFile(file)) {
    let jpeg: File
    try {
      jpeg = await deps.convertHeicToJpeg(file)
    } catch {
      throw new BlockedFileError(file.name)
    }
    return new File([jpeg], renameToJpg(file.name), { type: 'image/jpeg' })
  }

  return deps.compressImage(file)
}
