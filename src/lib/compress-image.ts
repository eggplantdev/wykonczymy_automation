import Compressor from 'compressorjs'

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
          const renamedFile = new File([compressed], originalFile.name, {
            type: compressed.type,
          })
          resolve(renamedFile)
        },
        error: (err) => reject(err),
      })
    })
  } catch (error) {
    console.error('Image compression failed, using original:', error)
    return originalFile
  }
}
