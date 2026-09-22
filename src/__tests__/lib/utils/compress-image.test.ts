import { describe, it, expect, beforeEach, vi } from 'vitest'

type OptionsT = {
  quality: number
  maxWidth: number
  maxHeight: number
  mimeType?: string
  success: (result: Blob) => void
  error: (reason: Error) => void
}

// CompressorJS answers through callbacks, so the double decides what "the browser" produced.
// Hoisted with the `vi.mock` factory, which is lifted above every `const` in this file. The
// implementation must be a `function`: compress-image calls `new Compressor(…)`, and an arrow
// throws "is not a constructor" — which compressImage swallows, turning every assertion green.
const { Compressor, setResponse } = vi.hoisted(() => {
  let respond: (file: File, options: OptionsT) => void = () => {}

  return {
    Compressor: vi.fn(function (this: unknown, file: File, options: OptionsT) {
      respond(file, options)
    }),
    setResponse: (next: (file: File, options: OptionsT) => void) => {
      respond = next
    },
  }
})

vi.mock('compressorjs', () => ({ default: Compressor }))

import { COMPRESSION_PROFILES, compressImage, compressToJpeg } from '@/lib/utils/compress-image'

function makeFile(name: string, type: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type })
}

// What CompressorJS actually hands `success`: `done()` builds a plain Blob and hangs the corrected
// filename off it as an expando. Returning a File here made the production narrowing look alive.
function compressorResult(name: string, type: string, size = 1024): Blob {
  return Object.assign(new Blob([new Uint8Array(size)], { type }), { name })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('compressImage', () => {
  it('keeps the picked filename when the format is unchanged', async () => {
    setResponse((_file, options) =>
      options.success(compressorResult('compressor-renamed.jpg', 'image/jpeg')),
    )

    const result = await compressImage(makeFile('faktura.jpg', 'image/jpeg'))

    expect(result.name).toBe('faktura.jpg')
  })

  it("takes CompressorJS's corrected extension when it re-encoded to another format", async () => {
    // A PNG over CompressorJS's own 5 MB `convertSize` is re-encoded to JPEG. Forcing the old name
    // back stored JPEG bytes at a `.png` path — reachable, because the size guard runs after this.
    setResponse((_file, options) => options.success(compressorResult('zrzut.jpg', 'image/jpeg')))

    const result = await compressImage(makeFile('zrzut.png', 'image/png'))

    expect(result.name).toBe('zrzut.jpg')
    expect(result.type).toBe('image/jpeg')
  })

  it('returns the original when the browser cannot re-encode it', async () => {
    setResponse((_file, options) => options.error(new Error('unsupported codec')))
    const original = makeFile('skan.bmp', 'image/bmp')

    expect(await compressImage(original)).toBe(original)
  })

  it('skips a PDF without reaching the encoder', async () => {
    const pdf = makeFile('faktura.pdf', 'application/pdf')

    expect(await compressImage(pdf)).toBe(pdf)
    expect(Compressor).not.toHaveBeenCalled()
  })
})

describe('compressToJpeg', () => {
  it('rejects rather than falling back, so the caller reaches for the WASM decoder', async () => {
    setResponse((_file, options) => options.error(new Error('canvas cannot decode HEIC')))

    await expect(compressToJpeg(makeFile('IMG_1234.heic', ''))).rejects.toThrow()
  })
})

describe('compression profiles', () => {
  // A `1920×1080` rectangle sized a portrait page by its HEIGHT, so an A4 scan came out at ~93 DPI
  // while a landscape photo of the same page kept 1920 — the orientation decided the resolution.
  // One cap on both axes is what makes the two agree.
  it('caps both axes at the same edge, so orientation no longer decides the resolution', async () => {
    const seen: OptionsT[] = []
    setResponse((_file, options) => {
      seen.push(options)
      options.success(compressorResult('strona.jpg', 'image/jpeg'))
    })

    await compressImage(makeFile('strona.jpg', 'image/jpeg'))

    expect(seen[0]!.maxWidth).toBe(seen[0]!.maxHeight)
  })

  it('gives a rysunek more edge and less loss than a faktura', async () => {
    const seen: OptionsT[] = []
    setResponse((_file, options) => {
      seen.push(options)
      options.success(compressorResult('rysunek.jpg', 'image/jpeg'))
    })

    await compressImage(makeFile('rysunek.jpg', 'image/jpeg'), 'PLAN')
    await compressImage(makeFile('faktura.jpg', 'image/jpeg'), 'INVOICE')

    const [plan, invoice] = seen
    expect(plan!.maxWidth).toBeGreaterThan(invoice!.maxWidth)
    expect(plan!.quality).toBeGreaterThan(invoice!.quality)
  })

  // Safari's HEIC route decodes AND resizes in this single pass, so a rysunek shot on an iPhone
  // would otherwise be the one PLAN file silently capped at the faktura's edge.
  it('honours the profile on the HEIC one-pass route too', async () => {
    const seen: OptionsT[] = []
    setResponse((_file, options) => {
      seen.push(options)
      options.success(compressorResult('IMG_1234.jpg', 'image/jpeg'))
    })

    await compressToJpeg(makeFile('IMG_1234.heic', ''), 'PLAN')

    expect(seen[0]!.maxWidth).toBe(COMPRESSION_PROFILES.PLAN.maxEdge)
    expect(seen[0]!.quality).toBe(COMPRESSION_PROFILES.PLAN.quality)
  })
})
