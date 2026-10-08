import { beforeEach, describe, it, expect, vi } from 'vitest'

// compress-image pulls in compressorjs (browser-only) at import time; nothing here calls it.
vi.mock('@/lib/utils/compress-image', () => ({ compressImage: async (f: File) => f }))

const { upload } = vi.hoisted(() => ({
  upload: vi.fn<(file: File, kind?: MediaKindT) => Promise<number>>(),
}))
vi.mock('@/lib/media/upload-media', () => ({ uploadMediaBySize: upload }))

import { UploadRefusedError } from '@/lib/media/upload-refused'
import { MediaUploadError, resolveUploadIdRows } from '@/lib/media/upload-ids'
import type { MediaKindT } from '@/types/media'

const file = (name: string) => ({ name }) as File

describe('resolveUploadIdRows', () => {
  beforeEach(() => {
    upload.mockReset()
  })

  it('uploads the File attached at a row', async () => {
    upload.mockImplementation(async () => 777)
    const files = new Map<number, File[]>([[0, [file('a.jpg')]]])

    const result = await resolveUploadIdRows(1, files)

    expect(result).toEqual([[777]])
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('returns an empty page list for a row with no File', async () => {
    upload.mockImplementation(async () => 1)
    const result = await resolveUploadIdRows(1, new Map())

    expect(result).toEqual([[]])
    expect(upload).not.toHaveBeenCalled()
  })

  it('uploads each row independently across a sparse set, preserving positions', async () => {
    upload.mockImplementation(async (f: File) => (f.name === 'b.jpg' ? 500 : 600))
    const files = new Map<number, File[]>([
      [1, [file('b.jpg')]],
      [2, [file('c.jpg')]],
    ])

    const result = await resolveUploadIdRows(3, files)

    expect(result).toEqual([[], [500], [600]])
    expect(upload).toHaveBeenCalledTimes(2)
  })

  // Page order IS the invoice's reading order, and uploads run concurrently — so a slow page 1
  // must still land at index 0. This is the guard for that regrouping.
  it('keeps a row’s pages in attachment order even when a later page uploads first', async () => {
    upload.mockImplementation(async (f: File) => {
      if (f.name === 'p1.jpg') await new Promise((resolve) => setTimeout(resolve, 5))
      return Number(f.name.replace(/\D/g, ''))
    })
    const files = new Map<number, File[]>([
      [0, [file('p1.jpg'), file('p2.jpg'), file('p3.jpg')]],
      [1, [file('p4.jpg')]],
    ])

    const result = await resolveUploadIdRows(2, files)

    expect(result).toEqual([[1, 2, 3], [4]])
  })

  // The pages that DID upload are already in Blob with nothing pointing at them, so the failure has
  // to hand them back — a bare throw leaks them.
  it('reports the already-uploaded ids when a page fails', async () => {
    upload.mockImplementation(async (f: File) => {
      if (f.name === 'p2.jpg') throw new UploadRefusedError('413')
      return Number(f.name.replace(/\D/g, ''))
    })
    const files = new Map<number, File[]>([[0, [file('p1.jpg'), file('p2.jpg')]]])

    await expect(resolveUploadIdRows(1, files)).rejects.toMatchObject({
      message: '413',
      uploadedIds: [1],
    })
    await expect(resolveUploadIdRows(1, files)).rejects.toBeInstanceOf(MediaUploadError)
  })

  it('reports a failed request in Polish, not the browser message', async () => {
    upload.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    const files = new Map<number, File[]>([[0, [file('p1.jpg')]]])

    await expect(resolveUploadIdRows(1, files)).rejects.toMatchObject({
      message: 'Nie udało się przesłać plików — spróbuj ponownie.',
    })
  })
})

// A later reader asks for the rysunki without opening every faktura only if `kind` reaches the row,
// and it crosses every layer between the form and the upload route, so it is easy to drop.
describe('resolveUploadIdRows — media kind', () => {
  beforeEach(() => {
    upload.mockReset().mockResolvedValue(1)
  })

  it('stamps the kind on every page of the pick', async () => {
    const files = new Map([[0, [file('rzut.pdf'), file('przekroj.pdf')]]])

    await resolveUploadIdRows(1, files, 'projekt')

    expect(upload.mock.calls).toEqual([
      [file('rzut.pdf'), 'projekt'],
      [file('przekroj.pdf'), 'projekt'],
    ])
  })

  it('leaves the kind unset when the pick was not marked', async () => {
    await resolveUploadIdRows(1, new Map([[0, [file('faktura.pdf')]]]))

    expect(upload.mock.calls).toEqual([[file('faktura.pdf'), undefined]])
  })
})
