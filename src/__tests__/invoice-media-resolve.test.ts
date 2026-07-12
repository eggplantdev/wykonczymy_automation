import { describe, it, expect, vi } from 'vitest'

// compress-image pulls in compressorjs (browser-only) at import time; the resolver never
// calls it (upload is injected here), so stub the module to keep the import Node-safe.
vi.mock('@/lib/utils/compress-image', () => ({ compressImage: async (f: File) => f }))

import { resolveInvoiceMediaIds } from '@/lib/utils/upload-file-client'

const file = (name: string) => ({ name }) as File

describe('resolveInvoiceMediaIds', () => {
  it('uses a stored mediaId and does NOT upload that row', async () => {
    const upload = vi.fn(async () => 999)
    const files = new Map<number, File>([[0, file('a.jpg')]])
    const mediaIds = new Map<number, number>([[0, 42]])

    const result = await resolveInvoiceMediaIds(1, files, mediaIds, upload)

    expect(result).toEqual([42])
    expect(upload).not.toHaveBeenCalled()
  })

  it('uploads a row that has a File but no stored mediaId', async () => {
    const upload = vi.fn(async () => 777)
    const files = new Map<number, File>([[0, file('a.jpg')]])
    const mediaIds = new Map<number, number>()

    const result = await resolveInvoiceMediaIds(1, files, mediaIds, upload)

    expect(result).toEqual([777])
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('returns undefined for a row with neither a File nor a stored mediaId', async () => {
    const upload = vi.fn(async () => 1)
    const result = await resolveInvoiceMediaIds(1, new Map(), new Map(), upload)

    expect(result).toEqual([undefined])
    expect(upload).not.toHaveBeenCalled()
  })

  it('resolves each row independently across a mixed set, preserving positions', async () => {
    const upload = vi.fn(async () => 500)
    const files = new Map<number, File>([
      [1, file('b.jpg')],
      [2, file('c.jpg')],
    ])
    const mediaIds = new Map<number, number>([[2, 88]])

    const result = await resolveInvoiceMediaIds(3, files, mediaIds, upload)

    expect(result).toEqual([undefined, 500, 88])
    expect(upload).toHaveBeenCalledTimes(1)
  })
})
