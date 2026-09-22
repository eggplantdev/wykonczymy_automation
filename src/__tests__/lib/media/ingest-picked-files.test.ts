import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ingestPickedFiles } from '@/lib/media/ingest-picked-files'
import { BlockedFileError } from '@/lib/utils/process-upload-file'

const mockProcess = vi.fn()

vi.mock('@/lib/utils/process-upload-file', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/utils/process-upload-file')>()),
  processUploadFile: (file: File) => mockProcess(file),
}))

function file(name: string) {
  return new File(['x'], name, { type: 'image/jpeg' })
}

describe('ingestPickedFiles', () => {
  beforeEach(() => {
    mockProcess.mockReset()
  })

  it('returns every survivor in pick order', async () => {
    mockProcess.mockImplementation(async (input: File) => input)

    const { files, blocked } = await ingestPickedFiles([file('a.jpg'), file('b.jpg')])

    expect(files.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(blocked).toEqual([])
  })

  // An undefined left in that list would be uploaded as a page.
  it('compacts the survivors, dropping the blocked file rather than leaving a hole', async () => {
    mockProcess.mockImplementation(async (input: File) => {
      if (input.name === 'b.jpg') throw new BlockedFileError('b.jpg')
      return input
    })

    const { files, blocked } = await ingestPickedFiles([
      file('a.jpg'),
      file('b.jpg'),
      file('c.jpg'),
    ])

    expect(files.map((f) => f.name)).toEqual(['a.jpg', 'c.jpg'])
    expect(blocked).toHaveLength(1)
    expect(blocked[0].filename).toBe('b.jpg')
  })

  it('every file blocked yields an empty list, so the caller uploads nothing', async () => {
    mockProcess.mockImplementation(async (input: File) => {
      throw new BlockedFileError(input.name)
    })

    const { files, blocked } = await ingestPickedFiles([file('a.jpg'), file('b.jpg')])

    expect(files).toEqual([])
    expect(blocked).toHaveLength(2)
  })

  it('an empty pick returns an empty result without touching the pipeline', async () => {
    const { files, blocked } = await ingestPickedFiles([])

    expect(files).toEqual([])
    expect(blocked).toEqual([])
    expect(mockProcess).not.toHaveBeenCalled()
  })

  it('a non-blocked failure rejects rather than being swallowed', async () => {
    mockProcess.mockRejectedValue(new Error('chunk load failed'))

    await expect(ingestPickedFiles([file('a.jpg')])).rejects.toThrow('chunk load failed')
  })
})
