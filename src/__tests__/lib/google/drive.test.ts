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

describe('createSheetFromTemplate', () => {
  it('copies the template, names it, returns the new id', async () => {
    copyMock.mockResolvedValueOnce({ data: { id: 'new-sheet-1' } })
    const { createSheetFromTemplate } = await import('@/lib/google/drive')
    const result = await createSheetFromTemplate('11 Listopada 40')
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
    const { createSheetFromTemplate } = await import('@/lib/google/drive')
    await createSheetFromTemplate('Kasprzaka 9')
    expect(copyMock.mock.calls[0][0].requestBody.parents).toEqual(['folder-id-xyz'])
  })

  it('throws if Drive returns no id', async () => {
    copyMock.mockResolvedValueOnce({ data: {} })
    const { createSheetFromTemplate } = await import('@/lib/google/drive')
    await expect(createSheetFromTemplate('X')).rejects.toThrow(/no file id/)
  })

  it('throws if KOSZTORYS_TEMPLATE_SHEET_ID is not set', async () => {
    delete process.env.KOSZTORYS_TEMPLATE_SHEET_ID
    const { createSheetFromTemplate } = await import('@/lib/google/drive')
    await expect(createSheetFromTemplate('X')).rejects.toThrow(/KOSZTORYS_TEMPLATE_SHEET_ID/)
  })
})

describe('isStorageQuotaError', () => {
  it('matches the structured reason on a top-level errors array', async () => {
    const { isStorageQuotaError } = await import('@/lib/google/drive')
    expect(isStorageQuotaError({ code: 403, errors: [{ reason: 'storageQuotaExceeded' }] })).toBe(
      true,
    )
  })

  it('matches the structured reason nested under response.data.error.errors', async () => {
    const { isStorageQuotaError } = await import('@/lib/google/drive')
    expect(
      isStorageQuotaError({
        response: { data: { error: { errors: [{ reason: 'storageQuotaExceeded' }] } } },
      }),
    ).toBe(true)
  })

  it('falls back to a message match when no structured reason is present', async () => {
    const { isStorageQuotaError } = await import('@/lib/google/drive')
    expect(
      isStorageQuotaError(new Error("The user's Drive storage quota has been exceeded.")),
    ).toBe(true)
  })

  it('is false for unrelated errors (different reason / message / nullish)', async () => {
    const { isStorageQuotaError } = await import('@/lib/google/drive')
    expect(isStorageQuotaError({ code: 404, errors: [{ reason: 'notFound' }] })).toBe(false)
    expect(isStorageQuotaError(new Error('Drive returned no file id'))).toBe(false)
    expect(isStorageQuotaError(undefined)).toBe(false)
  })
})
