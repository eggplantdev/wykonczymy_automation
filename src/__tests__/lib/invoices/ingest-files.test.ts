import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ingestFiles } from '@/lib/invoices/ingest-files'
import { BlockedFileError } from '@/lib/utils/process-upload-file'

const mockProcess = vi.fn()

vi.mock('@/lib/utils/process-upload-file', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/utils/process-upload-file')>()),
  processUploadFile: (file: File) => mockProcess(file),
}))

function file(name: string) {
  return new File(['x'], name, { type: 'image/jpeg' })
}

describe('ingestFiles', () => {
  beforeEach(() => {
    mockProcess.mockReset()
  })

  it('keeps the picked order', async () => {
    mockProcess.mockImplementation(async (input: File) => input)

    const { processed, blocked } = await ingestFiles([file('a.jpg'), file('b.jpg'), file('c.jpg')])

    expect(processed.map((f) => f?.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
    expect(blocked).toEqual([])
  })

  // The contract the expense form's row pairing rides on: a blocked file leaves a hole at its own
  // index instead of shifting the survivors left onto the wrong rows.
  it('a blocked file leaves undefined at its own index, the rest survive', async () => {
    mockProcess.mockImplementation(async (input: File) => {
      if (input.name === 'b.jpg') throw new BlockedFileError('b.jpg')
      return input
    })

    const { processed, blocked } = await ingestFiles([file('a.jpg'), file('b.jpg'), file('c.jpg')])

    expect(processed.map((f) => f?.name)).toEqual(['a.jpg', undefined, 'c.jpg'])
    expect(blocked).toHaveLength(1)
    expect(blocked[0].filename).toBe('b.jpg')
  })

  it('a non-blocked failure rejects rather than being swallowed', async () => {
    mockProcess.mockRejectedValue(new Error('chunk load failed'))

    await expect(ingestFiles([file('a.jpg')])).rejects.toThrow('chunk load failed')
  })
})
