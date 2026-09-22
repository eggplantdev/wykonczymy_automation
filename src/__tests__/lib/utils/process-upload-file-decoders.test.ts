import { describe, it, expect, beforeEach, vi } from 'vitest'

// The existing process-upload-file suite injects fake decoders, so the REAL defaultDeps — the
// Safari-canvas-first route and its WASM fallback — was never exercised. These mocks reach it
// through the public call, without a browser.
const { compressImage, compressToJpeg, heicTo } = vi.hoisted(() => ({
  compressImage: vi.fn(async (file: File, _profile?: string) => file),
  compressToJpeg: vi.fn(async (file: File, _profile?: string) => file),
  heicTo: vi.fn(
    async (_options: { blob: Blob; type: string; quality?: number }) =>
      new Blob([new Uint8Array(512)], { type: 'image/jpeg' }),
  ),
}))

vi.mock('@/lib/utils/compress-image', () => ({ compressImage, compressToJpeg }))
vi.mock('heic-to', () => ({ heicTo }))

import { processUploadFile, BlockedFileError } from '@/lib/utils/process-upload-file'

const heicFile = () => new File([new Uint8Array(3000)], 'IMG_1234.HEIC', { type: '' })

beforeEach(() => {
  vi.clearAllMocks()
  compressImage.mockImplementation(async (file: File) => file)
  compressToJpeg.mockImplementation(async (file: File) => file)
})

describe('the default HEIC route', () => {
  it('decodes on the canvas first, never downloading the WASM decoder', async () => {
    compressToJpeg.mockResolvedValue(
      new File([new Uint8Array(900)], 'IMG_1234.jpg', {
        type: 'image/jpeg',
      }),
    )

    const result = await processUploadFile(heicFile())

    expect(heicTo).not.toHaveBeenCalled()
    expect(result.name).toBe('IMG_1234.jpg')
  })

  it('decodes near-losslessly in the WASM fallback, leaving the quality to the compressor', async () => {
    // Decoding at the compressor's own quality compressed the same pixels twice, and the
    // scan-extraction consumer reads these bytes — the loss came out of OCR accuracy.
    compressToJpeg.mockRejectedValue(new Error('canvas cannot decode HEIC'))

    await processUploadFile(heicFile())

    expect(heicTo).toHaveBeenCalledOnce()
    const decodeQuality = heicTo.mock.calls[0]![0].quality
    // The canvas pass is handed a PROFILE, never a quality of its own — the profile's quality
    // (0.8 at the most) is what the decode has to stay above.
    expect(decodeQuality).toBeGreaterThan(0.9)
  })

  it('hands the picked profile to the compressor, not to the decoder', async () => {
    compressToJpeg.mockRejectedValue(new Error('canvas cannot decode HEIC'))

    await processUploadFile(heicFile(), 'PLAN')

    expect(compressToJpeg.mock.calls[0]![1]).toBe('PLAN')
    expect(compressImage.mock.calls[0]![1]).toBe('PLAN')
  })

  it('blocks the file when neither decoder can read it', async () => {
    compressToJpeg.mockRejectedValue(new Error('canvas cannot decode HEIC'))
    heicTo.mockRejectedValue(new Error('not a HEIC'))

    await expect(processUploadFile(heicFile())).rejects.toBeInstanceOf(BlockedFileError)
  })
})
