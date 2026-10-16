import type { CompressionProfileT } from '@/lib/utils/compress-image'

export class BlockedFileError extends Error {
  readonly filename: string

  constructor(filename: string) {
    super(`${filename}: heic-unconvertible`)
    this.name = 'BlockedFileError'
    this.filename = filename
  }
}

export type ProcessUploadDepsT = {
  compressImage: (file: File) => Promise<File>
  convertHeicToJpeg: (file: File) => Promise<File>
}

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
// alone.
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
