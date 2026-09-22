import { describe, it, expect, vi } from 'vitest'

import { processUploadFile, BlockedFileError } from '@/lib/utils/process-upload-file'

// Real File so `.size` / `.name` / `.type` behave like production; the byte length IS the size.
function makeFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type })
}

// The browser decoders are injected so the pure orchestration (classify → route → rewrite →
// error) is testable without CompressorJS/heic-to. Defaults to no-op fakes per test.
function deps(overrides?: {
  compressImage?: (file: File) => Promise<File>
  convertHeicToJpeg?: (file: File) => Promise<File>
}) {
  return {
    compressImage: overrides?.compressImage ?? vi.fn(async (f: File) => f),
    convertHeicToJpeg:
      overrides?.convertHeicToJpeg ?? vi.fn(async () => makeFile('decoded.jpg', 'image/jpeg', 512)),
  }
}

describe('processUploadFile', () => {
  it('treats a .heic with empty MIME as an image, converts it (not raw passthrough), and rewrites to .jpg', async () => {
    // Chrome/Firefox report an empty File.type for HEIC — the extension is the only signal.
    const input = makeFile('IMG_1234.HEIC', '', 3000)
    const convertHeicToJpeg = vi.fn(async () => makeFile('anything.jpg', 'image/jpeg', 900))
    const compressImage = vi.fn(async (f: File) => f)

    const result = await processUploadFile(
      input,
      'INVOICE',
      deps({ convertHeicToJpeg, compressImage }),
    )

    expect(convertHeicToJpeg).toHaveBeenCalledOnce()
    expect(compressImage).not.toHaveBeenCalled()
    expect(result.name).toBe('IMG_1234.jpg')
    expect(result.type).toBe('image/jpeg')
  })

  it('returns a non-image (PDF) under the limit unchanged, without converting or compressing', async () => {
    const input = makeFile('faktura.pdf', 'application/pdf', 2048)
    const convertHeicToJpeg = vi.fn(async () => makeFile('x.jpg', 'image/jpeg'))
    const compressImage = vi.fn(async (f: File) => f)

    const result = await processUploadFile(
      input,
      'INVOICE',
      deps({ convertHeicToJpeg, compressImage }),
    )

    expect(convertHeicToJpeg).not.toHaveBeenCalled()
    expect(compressImage).not.toHaveBeenCalled()
    expect(result).toBe(input)
  })

  it('routes a jpeg through the compressor, not the HEIC decoder', async () => {
    const input = makeFile('photo.jpg', 'image/jpeg', 5000)
    const compressed = makeFile('photo.jpg', 'image/jpeg', 1200)
    const compressImage = vi.fn(async () => compressed)
    const convertHeicToJpeg = vi.fn(async () => makeFile('x.jpg', 'image/jpeg'))

    const result = await processUploadFile(
      input,
      'INVOICE',
      deps({ compressImage, convertHeicToJpeg }),
    )

    expect(compressImage).toHaveBeenCalledOnce()
    expect(convertHeicToJpeg).not.toHaveBeenCalled()
    expect(result).toBe(compressed)
  })

  // Client uploads PUT the bytes straight to Blob, so the 4.5 MB request-body wall the old size
  // guard stood in front of no longer exists. A big scan is now a slow upload, not a refusal.
  it('lets a compressed file well over the old 4 MB guard through', async () => {
    const input = makeFile('big.jpg', 'image/jpeg', 100)
    const oversized = makeFile('big.jpg', 'image/jpeg', 9_000_000)
    const compressImage = vi.fn(async () => oversized)

    const result = await processUploadFile(input, 'INVOICE', deps({ compressImage }))

    expect(result).toBe(oversized)
  })

  it('passes a large non-image through untouched', async () => {
    const pdf = makeFile('umowa.pdf', 'application/pdf', 9_000_000)

    expect(await processUploadFile(pdf, 'INVOICE', deps())).toBe(pdf)
  })

  it('throws BlockedFileError when HEIC decoding fails', async () => {
    const input = makeFile('broken.heic', 'image/heic', 3000)
    const convertHeicToJpeg = vi.fn(async () => {
      throw new Error('no HEVC codec, WASM unavailable')
    })

    const promise = processUploadFile(input, 'INVOICE', deps({ convertHeicToJpeg }))

    await expect(promise).rejects.toBeInstanceOf(BlockedFileError)
    await expect(promise).rejects.toMatchObject({ filename: 'broken.heic' })
  })
})
