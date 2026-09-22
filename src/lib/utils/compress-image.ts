import Compressor from 'compressorjs'
import { logError } from '@/lib/utils/log-error'

/**
 * One cap on BOTH axes, not a `1920×1080` rectangle. A rectangle sizes a portrait page by its
 * height, so an A4 scan landed at ~93 DPI and the dimension line stopped being legible — the
 * orientation decided the resolution, which is never what the user meant.
 *
 * `INVOICE` stays the cheap profile — a faktura is read by OCR and by a human looking for a total.
 * It is not unchanged, though: the old `1920×1080` rectangle capped a landscape photo at 1440×1080
 * and this caps it at 1920×1440, so existing faktury grew too. That is the price of the portrait
 * fix, paid at the same quality. `PLAN` is for a rysunek techniczny, where the thing being read IS
 * the fine detail, so it buys back both edge and quality.
 */
export const COMPRESSION_PROFILES = {
  INVOICE: { maxEdge: 1920, quality: 0.6 },
  PLAN: { maxEdge: 2560, quality: 0.8 },
} as const

export type CompressionProfileT = keyof typeof COMPRESSION_PROFILES

/** Compress an image file client-side. Skips non-images and PDFs. Returns original on failure. */
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

// The stored filename is the one the user picked, so it is kept — except when CompressorJS
// re-encoded to another format. Its `convertSize` default re-encodes a PNG over 5 MB to JPEG and
// corrects the extension; forcing the old name back stored JPEG bytes at a `.png` path.
// The corrected name is read off the `name` expando because CompressorJS hands `success` a plain
// Blob carrying one — it never constructs a File, so narrowing on `instanceof File` never fired.
function named(compressed: Blob, originalFile: File): File {
  const correctedName =
    compressed.type !== originalFile.type
      ? (compressed as Blob & { name?: string }).name
      : undefined
  return new File([compressed], correctedName ?? originalFile.name, { type: compressed.type })
}

// Transcode to JPEG via CompressorJS (canvas). On Safari the canvas decodes HEIC via the OS HEVC
// codec, so forcing `mimeType: 'image/jpeg'` both decodes and resizes in one pass. Unlike
// compressImage, this REJECTS on failure (Chrome/Firefox can't decode HEIC on canvas) so the
// caller can fall back to a WASM decoder — it never silently returns the undecoded original.
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
