import { describe, it, expect, vi } from 'vitest'

// compress-image pulls in compressorjs (browser-only) at import time; nothing here calls it.
vi.mock('@/lib/utils/compress-image', () => ({ compressImage: async (f: File) => f }))

const { uploadMediaBySize } = vi.hoisted(() => ({
  uploadMediaBySize: vi.fn(async () => 1),
}))
vi.mock('@/lib/media/upload-media', () => ({ uploadMediaBySize }))

import { resolveUploadIds } from '@/lib/media/upload-ids'

const file = (name: string) => ({ name }) as File

// The whole point of the marker is that a later reader can ask for the rysunki without opening
// every faktura — which only works if `kind` reaches the media row. It is threaded through every
// layer between the form and the upload route, so it is easy to drop.
describe('resolveUploadIds — media kind', () => {
  it('stamps the kind on every page of the pick', async () => {
    uploadMediaBySize.mockClear()

    await resolveUploadIds([file('rzut.pdf'), file('przekroj.pdf')], 'projekt')

    expect(uploadMediaBySize.mock.calls).toEqual([
      [file('rzut.pdf'), { kind: 'projekt' }],
      [file('przekroj.pdf'), { kind: 'projekt' }],
    ])
  })

  it('leaves the kind unset when the pick was not marked', async () => {
    uploadMediaBySize.mockClear()

    await resolveUploadIds([file('faktura.pdf')])

    // `toEqual` reads `{ kind: undefined }` as `{}`, so this holds whether the key is absent or unset.
    expect(uploadMediaBySize.mock.calls).toEqual([[file('faktura.pdf'), {}]])
  })
})
