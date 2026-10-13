import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/utils/compress-image', () => ({ compressImage: async (f: File) => f }))

const { upload, discard } = vi.hoisted(() => ({
  upload: vi.fn<(file: File) => Promise<number>>(),
  discard: vi.fn<(ids: number[]) => void>(),
}))
vi.mock('@/lib/media/upload-media', () => ({ uploadMediaBySize: upload }))
vi.mock('@/lib/media/discard-orphaned-uploads', () => ({ discardOrphanedUploads: discard }))

import { submitWithUploadRows } from '@/lib/media/submit-with-uploads'

const file = (name: string) => ({ name }) as File

describe('submitWithUploadRows with existing media', () => {
  const photo = file('IMG_0001.jpg')
  const added = file('scan.pdf')
  const existingIdOf = (candidate: File) => (candidate === photo ? 42 : undefined)

  beforeEach(() => {
    upload.mockReset()
    discard.mockReset()
    upload.mockImplementation(async () => 900)
  })

  it('links a zgłoszenie photo by its id without uploading it', async () => {
    const submit = vi.fn(async () => ({ success: true as const }))

    await submitWithUploadRows(1, new Map([[0, [photo]]]), submit, existingIdOf)

    expect(upload).not.toHaveBeenCalled()
    expect(submit).toHaveBeenCalledWith([[42]])
  })

  it('uploads only the added file and keeps each row in page order', async () => {
    const submit = vi.fn(async () => ({ success: true as const }))

    await submitWithUploadRows(
      2,
      new Map([
        [0, [added, photo]],
        [1, [photo]],
      ]),
      submit,
      existingIdOf,
    )

    expect(upload).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith([[900, 42], [42]])
  })

  it('discards only the uploaded ids when the save fails', async () => {
    await submitWithUploadRows(
      1,
      new Map([[0, [photo, added]]]),
      async () => ({ success: false, error: 'nope' }),
      existingIdOf,
    )

    expect(discard).toHaveBeenCalledWith([900])
  })

  it('discards nothing when every page was linked', async () => {
    await submitWithUploadRows(
      1,
      new Map([[0, [photo]]]),
      async () => ({ success: false, error: 'nope' }),
      existingIdOf,
    )

    expect(discard).not.toHaveBeenCalled()
  })
})
