import Compressor from 'compressorjs'
import { logError } from '@/lib/utils/log-error'

const MAX_WIDTH = 1920
const MAX_HEIGHT = 1080
const QUALITY = 0.6

/** Compress an image file client-side. Skips non-images and PDFs. Returns original on failure. */
export async function compressImage(originalFile: File, quality = QUALITY): Promise<File> {
  const isImage = originalFile.type.startsWith('image/') && !originalFile.type.includes('svg')
  if (!isImage) return originalFile

  try {
    return await new Promise<File>((resolve, reject) => {
      new Compressor(originalFile, {
        quality,
        maxWidth: MAX_WIDTH,
        maxHeight: MAX_HEIGHT,
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

// Transcode to JPEG via CompressorJS (canvas). On Safari the canvas decodes HEIC through the OS
// HEVC codec, so forcing `mimeType: 'image/jpeg'` both decodes and resizes in one pass. Unlike
// compressImage, this REJECTS on failure (Chrome/Firefox can't decode HEIC on canvas) so the
// caller can fall back to a WASM decoder — it never silently returns the undecoded original.
export function compressToJpeg(originalFile: File, quality = QUALITY): Promise<File> {
  return new Promise<File>((resolve, reject) => {
    new Compressor(originalFile, {
      quality,
      maxWidth: MAX_WIDTH,
      maxHeight: MAX_HEIGHT,
      mimeType: 'image/jpeg',
      success: (compressed) =>
        resolve(new File([compressed], originalFile.name, { type: 'image/jpeg' })),
      error: (err) => reject(err),
    })
  })
}
