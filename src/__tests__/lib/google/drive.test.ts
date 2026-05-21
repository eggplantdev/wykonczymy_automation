import { describe, it, expect, vi, beforeEach } from 'vitest'

const copyMock = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation(function (this: object) {
        return this
      }),
    },
    drive: vi.fn().mockReturnValue({ files: { copy: copyMock } }),
  },
}))

beforeEach(() => {
  copyMock.mockReset()
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIITEST\n-----END PRIVATE KEY-----\n',
  })
  process.env.KOSZTORYS_TEMPLATE_SHEET_ID = 'template-id-abc'
  delete process.env.KOSZTORYS_DRIVE_FOLDER_ID
})

describe('createKosztorysFromTemplate', () => {
  it('copies the template, names it, returns the new id', async () => {
    copyMock.mockResolvedValueOnce({ data: { id: 'new-sheet-1' } })
    const { createKosztorysFromTemplate } = await import('@/lib/google/drive')
    const result = await createKosztorysFromTemplate('11 Listopada 40')
    expect(copyMock).toHaveBeenCalledWith({
      fileId: 'template-id-abc',
      requestBody: { name: 'Kosztorys – 11 Listopada 40' },
      fields: 'id',
    })
    expect(result).toEqual({ sheetId: 'new-sheet-1' })
  })

  it('places the copy into the destination folder when KOSZTORYS_DRIVE_FOLDER_ID is set', async () => {
    process.env.KOSZTORYS_DRIVE_FOLDER_ID = 'folder-id-xyz'
    copyMock.mockResolvedValueOnce({ data: { id: 'new-sheet-2' } })
    const { createKosztorysFromTemplate } = await import('@/lib/google/drive')
    await createKosztorysFromTemplate('Kasprzaka 9')
    expect(copyMock.mock.calls[0][0].requestBody.parents).toEqual(['folder-id-xyz'])
  })

  it('throws if Drive returns no id', async () => {
    copyMock.mockResolvedValueOnce({ data: {} })
    const { createKosztorysFromTemplate } = await import('@/lib/google/drive')
    await expect(createKosztorysFromTemplate('X')).rejects.toThrow(/no file id/)
  })

  it('throws if KOSZTORYS_TEMPLATE_SHEET_ID is not set', async () => {
    delete process.env.KOSZTORYS_TEMPLATE_SHEET_ID
    const { createKosztorysFromTemplate } = await import('@/lib/google/drive')
    await expect(createKosztorysFromTemplate('X')).rejects.toThrow(/KOSZTORYS_TEMPLATE_SHEET_ID/)
  })
})
