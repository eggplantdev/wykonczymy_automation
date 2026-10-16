import Compressor from 'compressorjs'
import { logError } from '@/lib/utils/log-error'

/**
 * A rectangle sizes a portrait page by its height, so an A4 scan landed at ~93 DPI and the dimension
 * line stopped being legible
 */
export const COMPRESSION_PROFILES = {
  INVOICE: { maxEdge: 1920, quality: 0.6 },
  PLAN: { maxEdge: 2560, quality: 0.8 },
} as const

export type CompressionProfileT = keyof typeof COMPRESSION_PROFILES

export async function compressImage(
  originalFile: File,
  profile: CompressionProfileT = 'INVOICE',
): Promise<File> {
  const isImage = originalFile.type.startsWith('image/') && !originalFile.type.includes('svg')
  if (!isImage) return originalFile

  const { maxEdge, quality } = COMPRESSION_PROFILES[profile]

  try {
    return await new Promise<File>((resolve, reject) => {
      new Compressor(originalFile, {
        quality,
        maxWidth: maxEdge,
        maxHeight: maxEdge,
        success: (compressed) => {
          if (process.env.NODE_ENV !== 'production') {
            const beforeKB = (originalFile.size / 1024).toFixed(1)
            const afterKB = (compressed.size / 1024).toFixed(1)
            const saved = originalFile.size
              ? ((1 - compressed.size / originalFile.size) * 100).toFixed(0)
              : '0'
            console.log(
              `[compress] ${originalFile.name}: ${beforeKB} KB → ${afterKB} KB (${Number(saved) >= 0 ? `−${saved}` : `+${Math.abs(Number(saved))}`}%)`,
            )
          }
          resolve(named(compressed, originalFile))
        },
        error: (err) => reject(err),
      })
    })
  } catch (error) {
    logError('Image compression failed, using original:', error)
    return originalFile
  }
}

// `convertSize` default re-encodes a PNG over 5 MB to JPEG and corrects the extension; forcing the
// old name back stored JPEG bytes at a `.png` path.
function named(compressed: Blob, originalFile: File): File {
  const correctedName =
    compressed.type !== originalFile.type
      ? (compressed as Blob & { name?: string }).name
      : undefined
  return new File([compressed], correctedName ?? originalFile.name, { type: compressed.type })
}

// this REJECTS on failure (Chrome/Firefox can't decode HEIC on canvas) so the caller can fall back to
// a WASM decoder
export function compressToJpeg(
  originalFile: File,
  profile: CompressionProfileT = 'INVOICE',
): Promise<File> {
  const { maxEdge, quality } = COMPRESSION_PROFILES[profile]
  return new Promise<File>((resolve, reject) => {
    new Compressor(originalFile, {
      quality,
      maxWidth: maxEdge,
      maxHeight: maxEdge,
      mimeType: 'image/jpeg',
      success: (compressed) =>
        resolve(new File([compressed], originalFile.name, { type: 'image/jpeg' })),
      error: (err) => reject(err),
    })
  })
}
